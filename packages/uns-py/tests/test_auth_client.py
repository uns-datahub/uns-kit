from __future__ import annotations

import base64
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

from uns_kit import AuthClient, ConfigFile
from uns_kit.secure_store import FileStore


def _jwt_with_exp(exp: int) -> str:
    header = base64.urlsafe_b64encode(json.dumps({"alg": "none", "typ": "JWT"}).encode("utf-8")).decode("ascii").rstrip("=")
    payload = base64.urlsafe_b64encode(json.dumps({"exp": exp}).encode("utf-8")).decode("ascii").rstrip("=")
    return f"{header}.{payload}."


class _AuthHandler(BaseHTTPRequestHandler):
    received_path = ""
    received_body: dict[str, object] = {}

    def do_POST(self) -> None:
        type(self).received_path = self.path
        length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(length).decode("utf-8")
        type(self).received_body = json.loads(raw_body) if raw_body else {}
        payload = {"accessToken": _jwt_with_exp(int(time.time()) + 3600)}
        data = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Set-Cookie", "RefreshToken=refresh-token; Path=/; HttpOnly")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, format: str, *args: object) -> None:
        return


def test_auth_client_create_reads_config_and_logs_in(tmp_path: Path) -> None:
    server = HTTPServer(("127.0.0.1", 0), _AuthHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    ConfigFile.clear_cache()

    config_path = tmp_path / "config.json"
    config_path.write_text(
        json.dumps(
            {
                "uns": {
                    "rest": f"http://127.0.0.1:{server.server_port}/api",
                    "email": "user@example.com",
                    "password": "secret",
                }
            }
        ),
        encoding="utf-8",
    )

    try:
        client = AuthClient.create(config_path)
        token = client.get_access_token()
    finally:
        server.shutdown()
        thread.join(timeout=5)
        ConfigFile.clear_cache()

    assert _AuthHandler.received_path == "/api/auth/login"
    assert _AuthHandler.received_body == {"email": "user@example.com", "password": "secret"}
    assert token
    assert client.refresh_token == "refresh-token"


def test_auth_client_uses_cached_unexpired_token() -> None:
    client = AuthClient("https://datahub.example.com/api")
    client.access_token = _jwt_with_exp(int(time.time()) + 3600)

    assert client.get_access_token() == client.access_token


def test_file_store_roundtrip(tmp_path: Path) -> None:
    store = FileStore("uns-auth:test", base_dir=tmp_path)

    store.set("accessToken", "token-1")
    assert store.get("accessToken") == "token-1"

    store.delete("accessToken")
    assert store.get("accessToken") is None


def test_auth_client_reuses_persisted_token(tmp_path: Path) -> None:
    store = FileStore("uns-auth:test", base_dir=tmp_path)
    token = _jwt_with_exp(int(time.time()) + 3600)
    store.set("accessToken", token)

    client = AuthClient("https://datahub.example.com/api", store=store)

    assert client.get_access_token() == token
