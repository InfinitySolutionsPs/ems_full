#!/usr/bin/env python3
import json
import os
import pathlib
import subprocess
import threading
import time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from zoneinfo import ZoneInfo

BACKUP_DIR = pathlib.Path(os.getenv("BACKUP_DIR", "/backups"))
STATE_FILE = BACKUP_DIR / "status.json"
TOKEN = os.getenv("BACKUP_API_TOKEN", "")
TZ = ZoneInfo(os.getenv("TZ", "Asia/Hebron"))
run_lock = threading.Lock()


def read_state():
    try:
        return json.loads(STATE_FILE.read_text())
    except Exception:
        return {"status": "never", "cloud_uploaded": False, "cloud_configured": False}


def cloud_configured():
    try:
        result = subprocess.run(["rclone", "listremotes", "--config", "/config/rclone/rclone.conf"], capture_output=True, text=True, timeout=5)
        return "onedrive:" in result.stdout.splitlines()
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

    def do_GET(self):
        if not self._authorized():
            return self._json(401, {"error": "غير مصرح"})
        if self.path == "/health":
            return self._json(200, {"ok": True})
        if self.path == "/status":
            state = read_state()
            state["cloud_configured"] = cloud_configured()
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


def scheduler():
    while True:
        now = datetime.now(TZ)
        if now.hour == 2:
            marker = BACKUP_DIR / f".scheduled-{now.date().isoformat()}"
            if not marker.exists():
                if start_backup("scheduled"):
                    marker.touch()
                    for old_marker in sorted(BACKUP_DIR.glob(".scheduled-*"))[:-14]:
                        old_marker.unlink(missing_ok=True)
        time.sleep(30)


if __name__ == "__main__":
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    threading.Thread(target=scheduler, daemon=True).start()
    ThreadingHTTPServer(("0.0.0.0", 8765), Handler).serve_forever()
