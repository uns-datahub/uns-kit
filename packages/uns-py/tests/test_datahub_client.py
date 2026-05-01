from __future__ import annotations

import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from uns_kit import UnsClient


class _LastValueHandler(BaseHTTPRequestHandler):
    received_path = ""
    received_auth = ""
    received_body: dict[str, object] = {}

    def do_POST(self) -> None:
        type(self).received_path = self.path
        type(self).received_auth = self.headers.get("Authorization", "")
        length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(length).decode("utf-8")
        type(self).received_body = json.loads(raw_body)
        payload = {
            "results": [
                {
                    "topic": "plant/line/asset/type/id/current",
                    "value": 42,
                    "values": {"value": 42},
                    "uom": "A",
                    "timestamp": "2026-04-10T06:00:00.000Z",
                    "dataGroup": "sensor",
                    "ageMs": 12,
                    "source": "cache",
                },
                {
                    "topic": "plant/line/asset/type/id/status",
                    "value": None,
                    "values": None,
                    "uom": None,
                    "timestamp": None,
                    "dataGroup": None,
                    "ageMs": None,
                    "source": "miss",
                },
            ],
            "stats": {"requested": 2, "hits": 1, "misses": 1, "cacheSize": 100},
        }
        data = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, format: str, *args: object) -> None:
        return


class _MissingLastValueHandler(BaseHTTPRequestHandler):
    received_paths: list[str] = []

    def do_POST(self) -> None:
        type(self).received_paths.append(self.path)
        data = b"Cannot POST /api/batch/last"
        self.send_response(404)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, format: str, *args: object) -> None:
        return


@pytest.mark.asyncio
async def test_uns_client_last_value_returns_topic_keyed_dict() -> None:
    server = HTTPServer(("127.0.0.1", 0), _LastValueHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        client = UnsClient(
            f"http://127.0.0.1:{server.server_port}",
            token="access-token",
        )
        response = client.last_value(
            [
                "plant/line/asset/type/id/current",
                "plant/line/asset/type/id/status",
            ]
        )
    finally:
        server.shutdown()
        thread.join(timeout=5)

    assert _LastValueHandler.received_path == "/api/batch/last"
    assert _LastValueHandler.received_auth == "Bearer access-token"
    assert response["plant/line/asset/type/id/current"]["value"] == 42
    assert response["plant/line/asset/type/id/status"]["source"] == "miss"


@pytest.mark.asyncio
async def test_uns_client_accepts_direct_api_url() -> None:
    server = HTTPServer(("127.0.0.1", 0), _LastValueHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        client = UnsClient(
            f"http://127.0.0.1:{server.server_port}/api",
            token="access-token",
        )
        response = client.last_value("plant/line/asset/type/id/current")
    finally:
        server.shutdown()
        thread.join(timeout=5)

    assert _LastValueHandler.received_path == "/api/batch/last"
    assert response["plant/line/asset/type/id/current"]["value"] == 42


def test_uns_client_last_value_returns_none_when_endpoint_is_missing() -> None:
    _MissingLastValueHandler.received_paths = []
    server = HTTPServer(("127.0.0.1", 0), _MissingLastValueHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        client = UnsClient(
            f"http://127.0.0.1:{server.server_port}/api",
            token="access-token",
        )
        response = client.last_value("plant/line/asset/type/id/current")
    finally:
        server.shutdown()
        thread.join(timeout=5)

    assert _MissingLastValueHandler.received_paths == ["/api/batch/last"]
    assert response is None


def test_uns_client_requires_token_or_auth_client() -> None:
    client = UnsClient("https://unsdatahub.sij.digital/api")

    with pytest.raises(RuntimeError, match="No access token available"):
        client.ensure_token()


def test_uns_client_uses_auth_client_for_lazy_auth() -> None:
    class _StubAuthClient:
        def get_access_token(self) -> str:
            return "token-from-auth-client"

    auth_client = _StubAuthClient()
    client = UnsClient("https://unsdatahub.sij.digital/api", auth_client=auth_client)

    client.ensure_token()

    assert client.access_token == "token-from-auth-client"


def test_uns_client_last_value_uses_auth_client_token() -> None:
    server = HTTPServer(("127.0.0.1", 0), _LastValueHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    class _StubAuthClient:
        def get_access_token(self) -> str:
            return "token-from-auth-client"

    try:
        client = UnsClient(
            f"http://127.0.0.1:{server.server_port}",
            auth_client=_StubAuthClient(),
        )
        response = client.last_value("plant/line/asset/type/id/current")
    finally:
        server.shutdown()
        thread.join(timeout=5)

    assert _LastValueHandler.received_auth == "Bearer token-from-auth-client"
    assert response["plant/line/asset/type/id/current"]["value"] == 42


def test_uns_client_creates_auth_client_in_background(monkeypatch: pytest.MonkeyPatch) -> None:
    class _StubAuthClient:
        def get_access_token(self) -> str:
            return "background-token"

    def _create():
        return _StubAuthClient()

    monkeypatch.setattr("uns_kit.datahub_client.AuthClient.create", _create)
    client = UnsClient("https://unsdatahub.sij.digital/api")

    client.ensure_token()

    assert client.access_token == "background-token"
