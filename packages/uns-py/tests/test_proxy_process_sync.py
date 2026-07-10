from __future__ import annotations

from contextlib import asynccontextmanager
import threading
from typing import Any

from uns_kit.core.proxy_process import UnsProxyProcess
from uns_kit.core.proxy_process_sync import UnsMqttProxySync, UnsProxyProcessSync
from uns_kit.core.uns_mqtt_proxy import MessageMode


class _FakeMessage:
    def __init__(self, topic: str, payload: bytes) -> None:
        self.topic = topic
        self.payload = payload


class _FakeAsyncClient:
    def __init__(self) -> None:
        self.messages_calls: list[Any] = []
        self.resilient_calls: list[Any] = []

    @asynccontextmanager
    async def messages(self, topics: str | list[str]):
        self.messages_calls.append(topics)

        async def iterator():
            yield _FakeMessage("uns-infra/test/one", b"one")
            yield _FakeMessage("uns-infra/test/two", b"two")

        yield iterator()

    async def resilient_messages(self, topics: str | list[str]):
        self.resilient_calls.append(topics)
        yield _FakeMessage("uns-infra/test/reconnect", b"three")


class _FakeAsyncProxy:
    def __init__(self) -> None:
        self.client = _FakeAsyncClient()
        self.topic_builder = object()
        self.instance_status_topic = "uns/status/test/"
        self.calls: list[tuple[str, Any]] = []

    async def publish_message(self, topic: str, payload: str | bytes) -> None:
        self.calls.append(("publish_message", topic, payload))

    async def publish_packet(self, topic: str, packet: dict[str, Any]) -> None:
        self.calls.append(("publish_packet", topic, packet))

    async def publish_mqtt_message(self, mqtt_message: dict[str, Any], mode: MessageMode = MessageMode.RAW) -> None:
        self.calls.append(("publish_mqtt_message", mqtt_message, mode))

    async def drain_publishes(self, *, timeout: float | None = None) -> None:
        self.calls.append(("drain_publishes", timeout))

    async def flush(self, *, timeout: float | None = None) -> None:
        self.calls.append(("flush", timeout))

    async def stop(self, *, drain: bool = True, timeout: float | None = None) -> None:
        self.calls.append(("stop", drain, timeout))

    async def close(self, *, drain: bool = True, timeout: float | None = None) -> None:
        self.calls.append(("close", drain, timeout))


def test_sync_process_wraps_async_mqtt_proxy(monkeypatch) -> None:
    state: dict[str, Any] = {"started": 0, "stopped": 0}
    fake_proxy = _FakeAsyncProxy()

    async def fake_start(self) -> None:
        state["started"] += 1

    async def fake_stop(self, *, drain: bool = True, timeout: float | None = None) -> None:
        state["stopped"] += 1

    async def fake_create_mqtt_proxy(self, instance_name: str, **kwargs: Any) -> _FakeAsyncProxy:
        state["instance_name"] = instance_name
        state["kwargs"] = kwargs
        return fake_proxy

    monkeypatch.setattr(UnsProxyProcess, "start", fake_start)
    monkeypatch.setattr(UnsProxyProcess, "stop", fake_stop)
    monkeypatch.setattr(UnsProxyProcess, "create_mqtt_proxy", fake_create_mqtt_proxy)

    process = UnsProxyProcessSync(
        "localhost",
        {"processName": "sync-process"},
    )
    process.start()

    proxy = process.create_mqtt_proxy_sync("publisher", port=1884, username="user")
    assert isinstance(proxy, UnsMqttProxySync)
    assert state["instance_name"] == "publisher"
    assert state["kwargs"]["port"] == 1884
    assert state["kwargs"]["username"] == "user"

    proxy.publish_message("raw/data/topic", "value")
    proxy.publish_packet("raw/data/topic", {"message": {"data": {"value": 1}}})
    proxy.publish_mqtt_message(
        {
            "topic": "raw/data/",
            "asset": "line-1",
            "objectType": "motor",
            "objectId": "main",
            "attributes": {
                "attribute": "status",
                "data": {"value": "RUNNING", "time": "2026-01-01T00:00:00Z"},
            },
        },
        mode=MessageMode.RAW,
    )
    with proxy.messages("uns-infra/#") as messages:
        assert [msg.payload for msg in messages] == [b"one", b"two"]
    assert [msg.payload for msg in proxy.resilient_messages("uns-infra/#")] == [b"three"]
    proxy.drain_publishes()
    proxy.flush()
    proxy.stop()
    proxy.close()
    process.stop()

    assert state["started"] == 1
    assert state["stopped"] == 1
    assert fake_proxy.calls == [
        ("publish_message", "raw/data/topic", "value"),
        ("publish_packet", "raw/data/topic", {"message": {"data": {"value": 1}}}),
        (
            "publish_mqtt_message",
            {
                "topic": "raw/data/",
                "asset": "line-1",
                "objectType": "motor",
                "objectId": "main",
                "attributes": {
                    "attribute": "status",
                    "data": {"value": "RUNNING", "time": "2026-01-01T00:00:00Z"},
                },
            },
            MessageMode.RAW,
        ),
        ("drain_publishes", None),
        ("flush", None),
        ("stop", True, 30.0),
        ("close", True, 30.0),
    ]
    assert fake_proxy.client.messages_calls == ["uns-infra/#"]
    assert fake_proxy.client.resilient_calls == ["uns-infra/#"]


def test_sync_proxy_subscribe_invokes_on_message(monkeypatch) -> None:
    state: dict[str, Any] = {"started": 0, "stopped": 0}
    fake_proxy = _FakeAsyncProxy()
    received: list[bytes] = []
    done = threading.Event()

    async def fake_start(self) -> None:
        state["started"] += 1

    async def fake_stop(self, *, drain: bool = True, timeout: float | None = None) -> None:
        state["stopped"] += 1

    async def fake_create_mqtt_proxy(self, instance_name: str, **kwargs: Any) -> _FakeAsyncProxy:
        return fake_proxy

    monkeypatch.setattr(UnsProxyProcess, "start", fake_start)
    monkeypatch.setattr(UnsProxyProcess, "stop", fake_stop)
    monkeypatch.setattr(UnsProxyProcess, "create_mqtt_proxy", fake_create_mqtt_proxy)

    process = UnsProxyProcessSync("localhost", {"processName": "sync-process"})
    process.start()
    proxy = process.create_mqtt_proxy_sync("subscriber")

    subscription = proxy.subscribe(
        "uns-infra/#",
        on_message=lambda message: (
            received.append(message.payload),
            done.set() if len(received) >= 1 else None,
        ),
    )
    assert done.wait(timeout=1.0)

    subscription.close()
    proxy.close()
    process.stop()

    assert received == [b"three"]
    assert fake_proxy.client.resilient_calls == ["uns-infra/#"]
    assert state == {"started": 1, "stopped": 1}


def test_sync_process_context_manager_starts_and_stops(monkeypatch) -> None:
    state = {"started": 0, "stopped": 0}

    async def fake_start(self) -> None:
        state["started"] += 1

    async def fake_stop(self, *, drain: bool = True, timeout: float | None = None) -> None:
        state["stopped"] += 1

    monkeypatch.setattr(UnsProxyProcess, "start", fake_start)
    monkeypatch.setattr(UnsProxyProcess, "stop", fake_stop)

    with UnsProxyProcessSync("localhost", {"processName": "sync-process"}) as process:
        assert process.get_process_name() == "sync-process"

    assert state == {"started": 1, "stopped": 1}
