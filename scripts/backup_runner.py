#!/usr/bin/env python3
import fcntl
import hashlib
import json
import os
import pathlib
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

BACKUP_DIR = pathlib.Path(os.getenv("BACKUP_DIR", "/backups"))
STATE_FILE = BACKUP_DIR / "status.json"
LOCK_FILE = BACKUP_DIR / ".backup.lock"
RCLONE_CONFIG = "/config/rclone/rclone.conf"
TZ = ZoneInfo(os.getenv("TZ", "Asia/Hebron"))


def write_state(**values):
    try:
        old = json.loads(STATE_FILE.read_text())
    except Exception:
        old = {}
    old.update(values)
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(old, ensure_ascii=False))
    tmp.replace(STATE_FILE)


def run(cmd, **kwargs):
    subprocess.run(cmd, check=True, **kwargs)


def main():
    source = sys.argv[1] if len(sys.argv) > 1 else "manual"
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    with LOCK_FILE.open("w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return 3

        now = datetime.now(TZ)
        stamp = now.strftime("%Y-%m-%d_%H-%M-%S")
        name = f"ems-backup-{stamp}.tar.gz"
        archive = BACKUP_DIR / name
        write_state(status="running", source=source, started_at=now.isoformat(), error=None)
        try:
            with tempfile.TemporaryDirectory(prefix="ems-backup-") as tmp_name:
                tmp = pathlib.Path(tmp_name)
                dump = tmp / "database.dump"
                env = os.environ.copy()
                env["PGPASSWORD"] = env.get("POSTGRES_PASSWORD", "")
                run([
                    "pg_dump", "--format=custom", "--no-owner", "--no-acl",
                    "--host", env.get("PGHOST", "postgres"),
                    "--port", env.get("PGPORT", "5432"),
                    "--username", env.get("POSTGRES_USER", "ems"),
                    "--dbname", env.get("POSTGRES_DB", "ems"),
                    "--file", str(dump),
                ], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
                upload_dir = pathlib.Path(os.getenv("UPLOADS_DIR", "/data/uploads"))
                if not upload_dir.is_dir():
                    upload_dir = tmp / "uploads"
                    upload_dir.mkdir()
                run(["tar", "-czf", str(archive), "-C", str(tmp), "database.dump", "-C", str(upload_dir.parent), upload_dir.name], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

            hasher = hashlib.sha256()
            with archive.open("rb") as stream:
                for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                    hasher.update(chunk)
            digest = hasher.hexdigest()
            remote = "onedrive-crypt:"
            cloud_uploaded = False
            cloud_message = "لم يتم إعداد OneDrive بعد"
            remotes = subprocess.run(["rclone", "listremotes", "--config", RCLONE_CONFIG], capture_output=True, text=True)
            if "onedrive-crypt:" in remotes.stdout.splitlines():
                try:
                    run(["rclone", "copyto", str(archive), f"{remote}/{name}", "--config", RCLONE_CONFIG, "--retries", "3", "--low-level-retries", "5"])
                    cloud_uploaded = True
                    cloud_message = "تم الرفع إلى OneDrive for Business"
                    run(["rclone", "delete", remote, "--min-age", "30d", "--config", RCLONE_CONFIG])
                except subprocess.CalledProcessError as error:
                    cloud_message = f"فشل رفع OneDrive (رمز {error.returncode})"

            cutoff = now - timedelta(days=7)
            for old_file in BACKUP_DIR.glob("ems-backup-*.tar.gz"):
                if old_file != archive and datetime.fromtimestamp(old_file.stat().st_mtime, TZ) < cutoff:
                    old_file.unlink(missing_ok=True)

            status = "success" if cloud_uploaded else "local_only"
            write_state(status=status, source=source, finished_at=datetime.now(TZ).isoformat(), filename=name,
                        size_bytes=archive.stat().st_size, sha256=digest, cloud_uploaded=cloud_uploaded,
                        cloud_message=cloud_message, error=None)
            print(f"Backup created: {name}; sha256={digest}; cloud={cloud_uploaded}")
            return 0
        except Exception as error:
            write_state(status="failed", source=source, finished_at=datetime.now(TZ).isoformat(), error=str(error))
            print(f"Backup failed: {error}", file=sys.stderr)
            return 1


if __name__ == "__main__":
    sys.exit(main())
