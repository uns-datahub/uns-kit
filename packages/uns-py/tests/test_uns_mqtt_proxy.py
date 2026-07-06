from __future__ import annotations

import asyncio

import pytest

from uns_kit.core.uns_mqtt_proxy import UnsMqttProxy


@pytest.mark.asyncio
async def test_publish_message_uses_bounded_concurrency() -> None:
    proxy = UnsMqttProxy(
        "localhost",
        process_name="test-process",
        instance_name="test-instance",
        publish_concurrency=3,
        max_pending_publishes=100,
    )

    current = 0
    max_observed = 0

    async def fake_publish_raw(topic: str, payload: str | bytes, *, qos: int = 0, retain: bool = False) -> None:
        nonlocal current, max_observed
        current += 1
        max_observed = max(max_observed, current)
        await asyncio.sleep(0.02)
        current -= 1

    proxy.client.publish_raw = fake_publish_raw  # type: ignore[method-assign]

    for index in range(8):
        await proxy.publish_message(f"test/{index}", f"payload-{index}")

    await proxy._stop_publish_workers()

    assert max_observed > 1
    assert max_observed <= 3


@pytest.mark.asyncio
async def test_publish_message_allows_unbounded_queue_configuration() -> None:
    proxy = UnsMqttProxy(
        "localhost",
        process_name="test-process",
        instance_name="test-instance",
        publish_concurrency=2,
        max_pending_publishes=0,
    )

    published: list[str] = []

    async def fake_publish_raw(topic: str, payload: str | bytes, *, qos: int = 0, retain: bool = False) -> None:
        await asyncio.sleep(0.01)
        published.append(topic)

    proxy.client.publish_raw = fake_publish_raw  # type: ignore[method-assign]

    for index in range(20):
        await proxy.publish_message(f"test/{index}", f"payload-{index}")

    await proxy._stop_publish_workers()

    assert len(published) == 20


@pytest.mark.asyncio
async def test_close_waits_for_enqueued_publishes() -> None:
    proxy = UnsMqttProxy(
        "localhost",
        process_name="test-process",
        instance_name="test-instance",
        publish_concurrency=2,
        max_pending_publishes=100,
    )

    published: list[str] = []

    async def fake_publish_raw(topic: str, payload: str | bytes, *, qos: int = 0, retain: bool = False) -> None:
        await asyncio.sleep(0.01)
        published.append(topic)

    async def fake_client_close() -> None:
        return None

    async def fake_proxy_stop() -> None:
        return None

    proxy.client.publish_raw = fake_publish_raw  # type: ignore[method-assign]
    proxy.client.close = fake_client_close  # type: ignore[method-assign]
    proxy.stop = fake_proxy_stop  # type: ignore[method-assign]

    for index in range(5):
        await proxy.publish_message(f"test/{index}", f"payload-{index}")

    await proxy.close()

    assert len(published) == 5
