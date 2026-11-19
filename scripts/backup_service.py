#!/usr/bin/env python3
import json
import os
import pathlib
import re
import subprocess
import threading
import time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from zoneinfo import ZoneInfo

BACKUP_DIR = pathlib.Path(os.getenv("BACKUP_DIR", "/backups"))
STATE_FILE = BACKUP_DIR / "status.json"
CONFIG_FILE = BACKUP_DIR / "config.json"
TOKEN = os.getenv("BACKUP_API_TOKEN", "")
TZ = ZoneInfo(os.getenv("TZ", "Asia/Hebron"))
DEFAULT_CONFIG = {"email": "", "schedule": "daily", "automatic": True}
ALLOWED_SCHEDULES = {"hourly", "daily", "weekly", "monthly"}
run_lock = threading.Lock()


def read_config():
    try:
        value = json.loads(CONFIG_FILE.read_text())
        return {
            "email": str(value.get("email", "")),
            "schedule": value.get("schedule", "daily") if value.get("schedule") in ALLOWED_SCHEDULES else "daily",
            "automatic": bool(value.get("automatic", True)),
        }
    except Exception:
        return DEFAULT_CONFIG.copy()


def write_config(value):
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    temporary = CONFIG_FILE.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2))
    temporary.replace(CONFIG_FILE)


def read_state():
    try:
        return json.loads(STATE_FILE.read_text())
    except Exception:
        return {"status": "never", "cloud_uploaded": False, "cloud_configured": False}


def cloud_configured():
    try:
        result = subprocess.run(["rclone", "listremotes", "--config", "/config/rclone/rclone.conf"], capture_output=True, text=True, timeout=5)
        remotes = result.stdout.splitlines()
        return "onedrive:" in remotes and "onedrive-crypt:" in remotes
    except Exception:
        return False


def start_backup(source):
    with run_lock:
        if read_state().get("status") == "running":
            return False
        with (BACKUP_DIR / "backup.log").open("ab") as log:
            subprocess.Popen(["python3", "/app/backup_runner.py", source], stdout=log, stderr=log,
                             start_new_session=True, close_fds=True)
        return True


class Handler(BaseHTTPRequestHandler):
    def _authorized(self):
        return bool(TOKEN) and self.headers.get("Authorization") == f"Bearer {TOKEN}"

    def _json(self, code, value):
        body = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            return json.loads(self.rfile.read(length) or b"{}")
        except Exception:
            return None

    def do_GET(self):
        if not self._authorized():
            return self._json(401, {"error": "غير مصرح"})
        if self.path == "/health":
            return self._json(200, {"ok": True})
        if self.path == "/status":
            state = read_state()
            state["cloud_configured"] = cloud_configured()
            state["config"] = read_config()
            return self._json(200, state)
        if self.path == "/download":
            state = read_state()
            name = state.get("filename")
            file = BACKUP_DIR / name if name else None
            if not file or not file.is_file():
                return self._json(404, {"error": "لا توجد نسخة احتياطية للتنزيل"})
            self.send_response(200)
            self.send_header("Content-Type", "application/gzip")
            self.send_header("Content-Disposition", f'attachment; filename="{file.name}"')
            self.send_header("Content-Length", str(file.stat().st_size))
            self.end_headers()
            with file.open("rb") as stream:
                while chunk := stream.read(1024 * 1024):
                    self.wfile.write(chunk)
            return
        self._json(404, {"error": "غير موجود"})

    def do_PUT(self):
        if not self._authorized():
            return self._json(401, {"error": "غير مصرح"})
        if self.path != "/config":
            return self._json(404, {"error": "غير موجود"})
        body = self._body()
        if not isinstance(body, dict):
            return self._json(400, {"error": "بيانات الإعدادات غير صحيحة"})
        email = str(body.get("email", "")).strip()
        schedule = body.get("schedule", "daily")
        automatic = bool(body.get("automatic", True))
        if email and not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
            return self._json(400, {"error": "يرجى إدخال بريد إلكتروني صحيح"})
        if schedule not in ALLOWED_SCHEDULES:
            return self._json(400, {"error": "دورية النسخ غير صحيحة"})
        config = {"email": email, "schedule": schedule, "automatic": automatic}
        write_config(config)
        return self._json(200, {"ok": True, "config": config})

    def do_POST(self):
        if not self._authorized():
            return self._json(401, {"error": "غير مصرح"})
        if self.path != "/run":
            return self._json(404, {"error": "غير موجود"})
        if not start_backup("manual"):
            return self._json(409, {"error": "هناك نسخة احتياطية قيد التنفيذ"})
        return self._json(202, {"ok": True, "status": "running"})

    def log_message(self, fmt, *args):
        print("backup-api: " + fmt % args)


def schedule_marker(now, schedule):
    if schedule == "hourly":
        return f".scheduled-hourly-{now.strftime('%Y-%m-%d-%H')}"
    if schedule == "weekly":
        return f".scheduled-weekly-{now.strftime('%G-W%V')}"
    if schedule == "monthly":
        return f".scheduled-monthly-{now.strftime('%Y-%m')}"
    return f".scheduled-daily-{now.date().isoformat()}"


def schedule_is_due(now, schedule):
    if schedule == "hourly":
        return True
    if schedule == "weekly":
        return now.weekday() == 0 and now.hour == 2
    if schedule == "monthly":
        return now.day == 1 and now.hour == 2
    return now.hour == 2


def scheduler():
    while True:
        config = read_config()
        now = datetime.now(TZ)
        if config["automatic"] and schedule_is_due(now, config["schedule"]):
            marker = BACKUP_DIR / schedule_marker(now, config["schedule"])
            if not marker.exists() and start_backup("scheduled"):
                marker.touch()
                for old_marker in sorted(BACKUP_DIR.glob(".scheduled-*"))[:-31]:
                    old_marker.unlink(missing_ok=True)
        time.sleep(30)


if __name__ == "__main__":
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    threading.Thread(target=scheduler, daemon=True).start()
    ThreadingHTTPServer(("0.0.0.0", 8765), Handler).serve_forever()
