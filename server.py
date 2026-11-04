#!/usr/bin/env python3
"""Статический сервер вьюера + приём готовых артефактов из браузера.

GET  /                     -> index.html (вьюер)
GET  /<path>               -> статика репозитория
POST /upload?name=<file>   -> сохранить тело запроса в model/<file>
GET  /download/obj.zip     -> zip с OBJ+MTL+текстурами
"""
import io
import os
import subprocess
import sys
import threading
import zipfile
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

ROOT = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(ROOT, "model")
ALLOWED_UPLOADS = {"fighter_relief.glb", "depth.png"}
PORT = int(os.environ.get("PORT", "8000"))


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *args):
        sys.stderr.write("[server] %s\n" % (fmt % args))

    def _send(self, code, body, ctype):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/download/obj.zip":
            os.makedirs(MODEL_DIR, exist_ok=True)
            names = [n for n in sorted(os.listdir(MODEL_DIR))
                     if n.endswith((".obj", ".mtl", ".png", ".jpg", ".jpeg"))]
            if not any(n.endswith(".obj") for n in names):
                self._send(404, "OBJ ещё не готов: дождитесь окончания построения модели".encode("utf-8"),
                           "text/plain; charset=utf-8")
                return
            buf = io.BytesIO()
            with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
                for n in names:
                    z.write(os.path.join(MODEL_DIR, n), n)
            self._send(200, buf.getvalue(), "application/zip")
            return
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/upload":
            self._send(404, b"not found", "text/plain")
            return
        name = os.path.basename((parse_qs(parsed.query).get("name", [""]) or [""])[0])
        if name not in ALLOWED_UPLOADS:
            self._send(400, b"bad name", "text/plain")
            return
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0 or length > 200 * 1024 * 1024:
            self._send(400, b"bad size", "text/plain")
            return
        body = self.rfile.read(length)
        os.makedirs(MODEL_DIR, exist_ok=True)
        dest = os.path.join(MODEL_DIR, name)
        with open(dest, "wb") as f:
            f.write(body)
        self._send(200, ('{"saved":"%s","bytes":%d}' % (name, len(body))).encode(), "application/json")
        if name == "fighter_relief.glb":
            threading.Thread(target=self._postprocess, daemon=True).start()

    @staticmethod
    def _postprocess():
        venv_py = os.path.join(ROOT, ".venv", "bin", "python")
        py = venv_py if os.path.exists(venv_py) else sys.executable
        try:
            subprocess.run([py, os.path.join(ROOT, "scripts", "postprocess.py")],
                           cwd=ROOT, timeout=600, capture_output=True)
        except Exception as e:  # noqa: BLE001
            sys.stderr.write("postprocess failed: %r\n" % e)


if __name__ == "__main__":
    os.makedirs(MODEL_DIR, exist_ok=True)
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print("serving on 0.0.0.0:%d" % PORT, flush=True)
    server.serve_forever()
