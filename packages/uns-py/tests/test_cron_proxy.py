from __future__ import annotations

import asyncio

import pytest

from uns_kit.cron import UnsCronProxy


@pytest.mark.asyncio
async def test_cron_proxy_emits_cron_events() -> None:
    proxy = UnsCronProxy("*/1 * * * * *")
    events: list[dict[str, str]] = []
    received = asyncio.Event()

    async def handle(event) -> None:
        events.append(event)
        received.set()

    proxy.event.on("cronEvent", handle)
    await proxy.start()

    try:
        await asyncio.wait_for(received.wait(), timeout=2.5)
    finally:
        await proxy.stop()

    assert events
    assert events[0]["cronExpression"] == "*/1 * * * * *"
