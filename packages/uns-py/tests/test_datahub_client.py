from __future__ import annotations

import json
import sys
import threading
import types
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from uns_kit import RangeResult, UnsClient


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
        length = int(self.headers.get("Content-Length", "0"))
        if length > 0:
            self.rfile.read(length)
        data = b"Cannot POST /api/batch/last"
        self.send_response(404)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, format: str, *args: object) -> None:
        return


class _CatchAllHandler(BaseHTTPRequestHandler):
    received_paths: list[str] = []
    received_body: dict[str, object] = {}
    received_auth = ""

    def do_GET(self) -> None:
        type(self).received_paths.append(self.path)
        type(self).received_auth = self.headers.get("Authorization", "")
        payload = {
            "data": [
                ["2026-05-01T06:36:39.690000Z", 1, ""],
                ["2026-05-01T06:38:19.878000Z", 2, ""],
            ],
            "stats": {
                "table": "uns_sij_hrm_furnace_data",
                "rowCount": 2,
                "raw": {
                    "columns": [
                        {"name": "timestamp", "type": "TIMESTAMP"},
                        {"name": "value", "type": "DOUBLE"},
                        {"name": "uom", "type": "VARCHAR"},
                    ]
                },
            },
        }
        data = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self) -> None:
        type(self).received_paths.append(self.path)
        type(self).received_auth = self.headers.get("Authorization", "")
        length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(length).decode("utf-8")
        type(self).received_body = json.loads(raw_body)
        payload = {
            "results": [
                {
                    "topic": "plant/line/asset/type/id/current",
                    "data": [["2026-05-01T06:36:39.690000Z", 42, "A"]],
                    "stats": {
                        "table": "uns_line_data",
                        "rowCount": 1,
                        "raw": {
                            "columns": [
                                {"name": "timestamp", "type": "TIMESTAMP"},
                                {"name": "value", "type": "DOUBLE"},
                                {"name": "uom", "type": "VARCHAR"},
                            ]
                        },
                    },
                }
            ],
            "stats": {"requested": 1, "succeeded": 1, "failed": 0},
        }
        data = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
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

    assert _LastValueHandler.received_path == "/api/catchall/batch/last"
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

    assert _LastValueHandler.received_path == "/api/catchall/batch/last"
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

    assert _MissingLastValueHandler.received_paths == ["/api/catchall/batch/last"]
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


def test_uns_client_get_attribute_data_returns_rows_and_metadata() -> None:
    _CatchAllHandler.received_paths = []
    server = HTTPServer(("127.0.0.1", 0), _CatchAllHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        client = UnsClient(
            f"http://127.0.0.1:{server.server_port}",
            token="access-token",
        )
        response = client.get_attribute_data(
            "sij/acroni/vv/hrm-furnace/equipment/pusher/output-quantity",
            **{
                "from": "2026-05-07T11:17:01.157Z",
                "to": "2026-05-07T11:22:01.157Z",
                "table": "uns_sij_hrm_furnace_data",
                "dedupe": False,
                "summaryOnly": False,
                "aggregate": "last",
            },
        )
    finally:
        server.shutdown()
        thread.join(timeout=5)

    parsed = urllib.parse.urlparse(_CatchAllHandler.received_paths[-1])
    params = urllib.parse.parse_qs(parsed.query)
    assert parsed.path == "/api/catchall/sij%2Facroni%2Fvv%2Fhrm-furnace%2Fequipment%2Fpusher%2Foutput-quantity"
    assert params["table"] == ["uns_sij_hrm_furnace_data"]
    assert params["aggregate"] == ["last"]
    assert response.stats["table"] == "uns_sij_hrm_furnace_data"
    assert response.data[0][1] == 1
    assert response.records()[0]["value"] == 1


def test_uns_client_get_data_fetches_generic_custom_data() -> None:
    _CatchAllHandler.received_paths = []
    server = HTTPServer(("127.0.0.1", 0), _CatchAllHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    original_do_get = _CatchAllHandler.do_GET

    def custom_get(self) -> None:
        type(self).received_paths.append(self.path)
        payload = {"items": [{"id": "pdo-1", "grade": "A"}]}
        data = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    _CatchAllHandler.do_GET = custom_get
    try:
        client = UnsClient(
            f"http://127.0.0.1:{server.server_port}/api",
            token="access-token",
        )
        response = client.get_data(
            "/projects/project-name/path-to-data/data",
            params={"fromDate": "20260325"},
        )
    finally:
        _CatchAllHandler.do_GET = original_do_get
        server.shutdown()
        thread.join(timeout=5)

    assert _CatchAllHandler.received_paths[-1] == "/api/projects/project-name/path-to-data/data?fromDate=20260325"
    assert response["items"] == [{"id": "pdo-1", "grade": "A"}]


def test_catchall_result_to_dataframe_uses_pandas_when_available(monkeypatch: pytest.MonkeyPatch) -> None:
    result = RangeResult(
        data=[["2026-05-01T06:36:39.690000Z", 1, ""]],
        stats={
            "raw": {
                "columns": [
                    {"name": "timestamp"},
                    {"name": "value"},
                    {"name": "uom"},
                ]
            }
        },
    )
    stub_pandas = types.SimpleNamespace(DataFrame=lambda data, columns=None: {"data": data, "columns": columns})
    monkeypatch.setitem(sys.modules, "pandas", stub_pandas)

    dataframe = result.to_dataframe()

    assert dataframe["columns"] == ["timestamp", "value", "uom"]
    assert dataframe["data"][0][1] == 1


def test_uns_client_history_returns_per_topic_results() -> None:
    _CatchAllHandler.received_paths = []
    _CatchAllHandler.received_body = {}
    server = HTTPServer(("127.0.0.1", 0), _CatchAllHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        client = UnsClient(
            f"http://127.0.0.1:{server.server_port}/api",
            token="access-token",
        )
        response = client.history(
            ["plant/line/asset/type/id/current"],
            **{
                "from": "2026-05-07T11:17:01.157Z",
                "to": "2026-05-07T11:22:01.157Z",
                "limit": 500,
                "dedupe": False,
            },
        )
    finally:
        server.shutdown()
        thread.join(timeout=5)

    assert _CatchAllHandler.received_paths[-1] == "/api/catchall/batch/range"
    assert _CatchAllHandler.received_body["topics"] == ["plant/line/asset/type/id/current"]
    assert _CatchAllHandler.received_body["limit"] == 500
    assert response.results[0].data[0][1] == 42
    assert response.by_topic["plant/line/asset/type/id/current"]["stats"]["table"] == "uns_line_data"
