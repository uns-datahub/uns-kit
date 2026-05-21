from __future__ import annotations

import asyncio
import base64
import json
import urllib.request
import urllib.error

import pytest
import jwt

from uns_kit.api import UnsApiProxy
from uns_kit.core import TopicBuilder


class _FakeClient:
    def __init__(self) -> None:
        self.published: list[tuple[str, str | bytes, bool]] = []

    async def publish_raw(self, topic: str, payload: str | bytes, retain: bool = False) -> None:
        self.published.append((topic, payload, retain))


@pytest.mark.asyncio
async def test_api_proxy_serves_uns_routes_and_swagger() -> None:
    client = _FakeClient()
    proxy = UnsApiProxy(
        client,
        process_name="test-process",
        instance_name="test-api",
        topic_builder=TopicBuilder("uns-kit", "0.0.1", "test-process"),
    )
    await proxy.start()

    async def handle_get(event) -> None:
        event.res.json({"status": "ok", "query": dict(event.req.query_params)})

    async def handle_post(event) -> None:
        body = await event.req.json()
        event.res.json({"received": body})

    proxy.event.on("apiGetEvent", handle_get)
    proxy.event.on("apiPostEvent", handle_post)

    await proxy.get(
        "enterprise/site/area/line/",
        "line-3-furnace",
        "energy-resource",
        "main-bus",
        "current",
        {
            "apiDescription": "Current reading",
            "queryParams": [
                {"name": "limit", "type": "number", "required": False, "defaultValue": 100},
            ],
        },
    )
    await proxy.post(
        "enterprise/site/area/line/",
        "line-3-furnace",
        "energy-resource",
        "main-bus",
        "setpoint",
        {
            "apiDescription": "Setpoint update",
            "requestBody": {
                "description": "Setpoint payload",
                "required": True,
                "schema": {"type": "object"},
            },
        },
    )

    get_url = f"http://127.0.0.1:{proxy._port}/api/enterprise/site/area/line/line-3-furnace/energy-resource/main-bus/current?limit=25"
    with urllib.request.urlopen(get_url) as response:
        get_payload = json.loads(response.read().decode("utf-8"))
    assert get_payload == {"status": "ok", "query": {"limit": "25"}}

    post_request = urllib.request.Request(
        f"http://127.0.0.1:{proxy._port}/api/enterprise/site/area/line/line-3-furnace/energy-resource/main-bus/setpoint",
        data=json.dumps({"value": 42}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(post_request) as response:
        post_payload = json.loads(response.read().decode("utf-8"))
    assert post_payload == {"received": {"value": 42}}

    with urllib.request.urlopen(f"http://127.0.0.1:{proxy._port}{proxy.swagger_json_path}") as response:
        swagger_payload = json.loads(response.read().decode("utf-8"))
    assert "/api/status" in swagger_payload["paths"]
    assert "/api/enterprise/site/area/line/line-3-furnace/energy-resource/main-bus/current" in swagger_payload["paths"]
    assert swagger_payload["paths"]["/api/enterprise/site/area/line/line-3-furnace/energy-resource/main-bus/current"]["get"]["summary"] == "Current reading"

    await proxy.stop()


@pytest.mark.asyncio
async def test_api_proxy_reports_rsa_token_with_jwt_secret_misconfiguration() -> None:
    client = _FakeClient()
    proxy = UnsApiProxy(
        client,
        process_name="test-process",
        instance_name="test-api",
        topic_builder=TopicBuilder("uns-kit", "0.0.1", "test-process"),
        options={"jwtSecret": "CHANGEME"},
    )
    token = ".".join(
            [
                _b64url_json({"alg": "RS256", "typ": "JWT"}),
                _b64url_json({"email": "user@example.com"}),
                base64.urlsafe_b64encode(b"signature").decode("ascii").rstrip("="),
            ]
        )

    with pytest.raises(ValueError, match="requires JWKS or a public key"):
        await proxy._decode_token(token)


@pytest.mark.asyncio
async def test_api_proxy_jwt_secret_ignores_audience_like_ts_default() -> None:
    proxy = UnsApiProxy(
        _FakeClient(),
        process_name="test-process",
        instance_name="test-api",
        topic_builder=TopicBuilder("uns-kit", "0.0.1", "test-process"),
        options={"jwtSecret": "secret"},
    )
    token = jwt.encode(
        {"email": "user@example.com", "aud": "uns-datahub"},
        "secret",
        algorithm="HS256",
    )

    payload = await proxy._decode_token(token)

    assert payload["email"] == "user@example.com"


@pytest.mark.asyncio
async def test_api_proxy_rejects_malformed_bearer_token_with_401() -> None:
    proxy = UnsApiProxy(
        _FakeClient(),
        process_name="test-process",
        instance_name="test-api",
        topic_builder=TopicBuilder("uns-kit", "0.0.1", "test-process"),
        options={"jwks": {"wellKnownJwksUrl": "https://example.invalid/jwks.json"}},
    )
    await proxy.start()

    async def handle_get(event) -> None:
        event.res.json({"status": "ok"})

    proxy.event.on("apiGetEvent", handle_get)
    await proxy.get("root/", "asset", "type", "id", "value")
    request = urllib.request.Request(
        f"http://127.0.0.1:{proxy._port}/api/root/asset/type/id/value",
        headers={"Authorization": "Bearer daijdoasi"},
    )

    try:
        with pytest.raises(urllib.error.HTTPError) as error_info:
            urllib.request.urlopen(request)
        assert error_info.value.code == 401
        assert json.loads(error_info.value.read().decode("utf-8")) == {"error": "Invalid token"}
    finally:
        await proxy.stop()


def _b64url_json(payload: dict[str, str]) -> str:
    return base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8")).decode("ascii").rstrip("=")


@pytest.mark.asyncio
async def test_api_proxy_supports_unregister_catchall_and_status_response() -> None:
    client = _FakeClient()
    proxy = UnsApiProxy(
        client,
        process_name="test-process",
        instance_name="test-api",
        topic_builder=TopicBuilder("uns-kit", "0.0.1", "test-process"),
    )
    await proxy.start()

    async def handle_get(event) -> None:
        if event.req.url.path.endswith("/custom-error"):
            event.res.status(418).json({"error": "teapot"})
            return
        event.res.json({"path": event.req.url.path})

    proxy.event.on("apiGetEvent", handle_get)

    await proxy.get("root/", "asset", "type", "id", "custom-error")
    request_url = f"http://127.0.0.1:{proxy._port}/api/root/asset/type/id/custom-error"
    with pytest.raises(urllib.error.HTTPError) as error_info:
        urllib.request.urlopen(request_url)
    assert error_info.value.code == 418
    assert json.loads(error_info.value.read().decode("utf-8")) == {"error": "teapot"}

    await proxy.unregister("root/", "asset", "type", "id", "custom-error", "GET")
    with pytest.raises(urllib.error.HTTPError) as missing_error:
        urllib.request.urlopen(request_url)
    assert missing_error.value.code == 404

    await proxy.register_catch_all(
        "sij/acroni/#",
        {
            "apiDescription": "Catch-all handler",
            "swaggerPath": "/test-process/test-api/catchall-swagger.json",
        },
    )
    with urllib.request.urlopen(f"http://127.0.0.1:{proxy._port}/api/sij/acroni/demo/topic") as response:
        payload = json.loads(response.read().decode("utf-8"))
    assert payload == {"path": "/api/sij/acroni/demo/topic"}

    with urllib.request.urlopen(f"http://127.0.0.1:{proxy._port}/test-process/test-api/catchall-swagger.json") as response:
        catchall_swagger = json.loads(response.read().decode("utf-8"))
    assert "/api/{topicPath}" in catchall_swagger["paths"]

    await proxy.stop()
