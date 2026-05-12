#!/usr/bin/env python3
import json
import os
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("OQQUSH_SYNC_PORT", "3050"))
BACKUP_PATH = os.environ.get("OQQUSH_BACKUP_PATH", "/var/www/oqqush-beton/site-backup.json")
MAX_BODY_BYTES = 140 * 1024 * 1024


def read_current_admin_pass():
    env_pass = os.environ.get("OQQUSH_SYNC_PASS")
    if env_pass:
        return env_pass
    try:
        with open(BACKUP_PATH, "r", encoding="utf-8") as file:
            backup = json.load(file)
        return str((backup.get("localStorage") or {}).get("admin_pass") or "")
    except Exception:
        return ""


class SiteSyncHandler(BaseHTTPRequestHandler):
    def send_json(self, status, payload):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path != "/api/site-backup":
            self.send_json(404, {"ok": False, "error": "Not found"})
            return
        try:
            with open(BACKUP_PATH, "rb") as file:
                data = file.read()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)
        except Exception:
            self.send_json(404, {"ok": False, "error": "Backup not found"})

    def do_POST(self):
        if self.path != "/api/site-backup":
            self.send_json(404, {"ok": False, "error": "Not found"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY_BYTES:
                self.send_json(413, {"ok": False, "error": "Payload too large"})
                return

            raw_body = self.rfile.read(length).decode("utf-8")
            backup = json.loads(raw_body)
            local_storage = backup.get("localStorage")
            if not isinstance(local_storage, dict):
                self.send_json(400, {"ok": False, "error": "Invalid backup"})
                return

            admin_pass = self.headers.get("X-Oqqush-Admin-Pass", "")
            expected_pass = read_current_admin_pass()
            submitted_pass = str(local_storage.get("admin_pass") or "")
            if expected_pass and admin_pass not in (expected_pass, submitted_pass):
                self.send_json(403, {"ok": False, "error": "Forbidden"})
                return

            backup["version"] = 2
            backup["exportedAt"] = __import__("datetime").datetime.utcnow().isoformat(timespec="seconds") + "Z"
            directory = os.path.dirname(BACKUP_PATH)
            os.makedirs(directory, exist_ok=True)
            fd, tmp_path = tempfile.mkstemp(prefix="site-backup-", suffix=".json", dir=directory)
            with os.fdopen(fd, "w", encoding="utf-8") as file:
                json.dump(backup, file, ensure_ascii=False)
            os.replace(tmp_path, BACKUP_PATH)
            self.send_json(200, {"ok": True, "exportedAt": backup["exportedAt"]})
        except Exception as error:
            self.send_json(500, {"ok": False, "error": str(error)})

    def log_message(self, format, *args):
        return


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), SiteSyncHandler)
    print(f"Oqqush site sync listening on 127.0.0.1:{PORT}")
    print(f"Backup path: {BACKUP_PATH}")
    server.serve_forever()
