from __future__ import annotations

import base64
import json
import mimetypes
import os
import shutil
import subprocess
import time
import urllib.parse
import urllib.request
import uuid
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tkinter import Tk, messagebox


ROOT = Path(__file__).resolve().parent
WEB_DIR = ROOT / "web"
DATA_DIR = ROOT / "科研工作台数据"
DEFAULT_DATA_DIR = ROOT / "默认数据"
WEB_PORT = 8765
DATA_PORT = 8766
WEB_URL = f"http://localhost:{WEB_PORT}/"
DATA_URL = f"http://127.0.0.1:{DATA_PORT}"

DATA_FILES = {
    "ideas": DATA_DIR / "灵感" / "ideas.json",
    "notes": DATA_DIR / "便利贴" / "notes.json",
    "tags": DATA_DIR / "标签" / "tags.json",
    "tasks": DATA_DIR / "任务" / "tasks.json",
    "shots": DATA_DIR / "截图" / "index.json",
    "settings": DATA_DIR / "设置" / "settings.json",
}
IMAGE_DIR = DATA_DIR / "截图" / "图片"


def read_json(file: Path, fallback):
    try:
        return json.loads(file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return fallback


def write_json(file: Path, value) -> None:
    file.parent.mkdir(parents=True, exist_ok=True)
    temporary = file.with_suffix(file.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(file)


class DataHandler(BaseHTTPRequestHandler):
    server_version = "ResearchWorkbench/1.0"

    def log_message(self, _format, *_args) -> None:
        return

    def cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", WEB_URL.rstrip("/"))
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def send_json(self, value, status: int = 200) -> None:
        content = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def read_body(self) -> dict:
        length = min(int(self.headers.get("Content-Length", "0")), 30 * 1024 * 1024)
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.cors_headers()
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/data":
            settings = read_json(DATA_FILES["settings"], {})
            self.send_json({
                "ideas": read_json(DATA_FILES["ideas"], []),
                "notes": read_json(DATA_FILES["notes"], []),
                "tags": read_json(DATA_FILES["tags"], []),
                "tasks": read_json(DATA_FILES["tasks"], []),
                "shots": read_json(DATA_FILES["shots"], []),
                "accent": settings.get("accent", "#ec2464"),
            })
            return
        if parsed.path == "/api/image":
            filename = Path(urllib.parse.parse_qs(parsed.query).get("file", [""])[0]).name
            file = IMAGE_DIR / filename
            if not filename or not file.is_file():
                self.send_error(404)
                return
            content = file.read_bytes()
            self.send_response(200)
            self.cors_headers()
            self.send_header("Content-Type", mimetypes.guess_type(file.name)[0] or "application/octet-stream")
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "private, max-age=31536000, immutable")
            self.end_headers()
            self.wfile.write(content)
            return
        self.send_error(404)

    def do_POST(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        try:
            body = self.read_body()
            if parsed.path == "/api/data":
                for key in ("ideas", "notes", "tags", "tasks", "shots"):
                    write_json(DATA_FILES[key], body.get(key, []))
                write_json(DATA_FILES["settings"], {"accent": body.get("accent", "#ec2464")})
                self.send_json({"saved": True})
                return
            if parsed.path == "/api/image":
                header, encoded = str(body.get("src", "")).split(",", 1)
                mime = header.removeprefix("data:").split(";", 1)[0]
                extensions = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif"}
                if mime not in extensions:
                    raise ValueError("不支持的图片格式")
                content = base64.b64decode(encoded, validate=True)
                if len(content) > 20 * 1024 * 1024:
                    raise ValueError("图片不能超过 20MB")
                image_id = uuid.uuid4().hex
                filename = image_id + extensions[mime]
                IMAGE_DIR.mkdir(parents=True, exist_ok=True)
                (IMAGE_DIR / filename).write_bytes(content)
                self.send_json({
                    "id": image_id,
                    "name": str(body.get("name") or "截图"),
                    "src": f"{DATA_URL}/api/image?file={filename}",
                })
                return
        except (ValueError, KeyError, json.JSONDecodeError) as error:
            self.send_json({"error": str(error)}, 400)
            return
        self.send_error(404)


def url_ready(url: str) -> bool:
    try:
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with opener.open(url, timeout=1) as response:
            return response.status == 200
    except Exception:
        return False


def show_error(text: str) -> None:
    root = Tk()
    root.withdraw()
    messagebox.showerror("科研工作台", text)
    root.destroy()


def start_web_server() -> bool:
    if url_ready(WEB_URL):
        return True
    flags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS | subprocess.CREATE_NO_WINDOW
    try:
        subprocess.Popen(
            ["npm.cmd", "run", "dev", "--", "--port", str(WEB_PORT)],
            cwd=WEB_DIR,
            env=os.environ.copy(),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=flags,
            close_fds=True,
        )
    except OSError:
        return False
    for _ in range(80):
        if url_ready(WEB_URL):
            return True
        time.sleep(0.5)
    return False


def main() -> None:
    if not DATA_DIR.exists() and DEFAULT_DATA_DIR.exists():
        shutil.copytree(DEFAULT_DATA_DIR, DATA_DIR)
    else:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
    try:
        data_server = ThreadingHTTPServer(("127.0.0.1", DATA_PORT), DataHandler)
    except OSError:
        data_server = None

    if not start_web_server():
        show_error("本地网页启动失败，请确认 Node.js 与 npm 可用。")
        return

    webbrowser.open(WEB_URL)
    if data_server:
        data_server.serve_forever()


if __name__ == "__main__":
    main()
