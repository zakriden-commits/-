"""Tiny static server with HTTP Range support (so the mp4 can be seeked/streamed)."""
import http.server
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = 8000


class _RangeFile:
    def __init__(self, f, remaining):
        self.f = f
        self.remaining = remaining

    def read(self, k=-1):
        if self.remaining <= 0:
            return b""
        if k < 0 or k > self.remaining:
            k = self.remaining
        data = self.f.read(k)
        self.remaining -= len(data)
        return data

    def close(self):
        self.f.close()


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, *a):
        pass

    def send_head(self):
        path = self.translate_path(self.path)
        rng = self.headers.get("Range")
        if not rng or not os.path.isfile(path):
            self.send_header_extra = True
            return super().send_head()
        size = os.path.getsize(path)
        m = re.match(r"bytes=(\d*)-(\d*)", rng)
        if not m:
            return super().send_head()
        start = int(m.group(1)) if m.group(1) else 0
        end = int(m.group(2)) if m.group(2) else size - 1
        end = min(end, size - 1)
        if start > end:
            self.send_error(416)
            return None
        f = open(path, "rb")
        f.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        return _RangeFile(f, end - start + 1)

    def end_headers(self):
        if self.headers.get("Range") is None:
            self.send_header("Accept-Ranges", "bytes")
        super().end_headers()


if __name__ == "__main__":
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler) as httpd:
        print(f"serving {ROOT} on :{PORT}", flush=True)
        httpd.serve_forever()
