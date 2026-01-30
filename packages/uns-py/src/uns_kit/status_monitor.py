from __future__ import annotations

import asyncio
import tracemalloc
from datetime import datetime
from typing import Callable, Optional

from .client import UnsMqttClient
from .packet import UnsPacket
from .topic_builder import TopicBuilder


class StatusMonitor:
    """
    Periodically publishes process-level status topics:
    - active
    - heap-used
    - heap-total
    """

    def __init__(
        self,
        client: UnsMqttClient,
        topic_builder: TopicBuilder,
        active_supplier: Callable[[], bool],
        interval_s: float = 10.0,
    ) -> None:
        self._client = client
        self._topic_builder = topic_builder
        self._active_supplier = active_supplier
        self._interval_s = interval_s
        self._memory_task: Optional[asyncio.Task] = None
        self._status_task: Optional[asyncio.Task] = None
        self._running = False

    async def start(self) -> None:
        if self._running:
            return
        if not tracemalloc.is_tracing():
            tracemalloc.start()
        self._running = True
        self._memory_task = asyncio.create_task(self._publish_memory_loop())
        self._status_task = asyncio.create_task(self._publish_active_loop())

    async def stop(self) -> None:
        self._running = False
        for task in (self._memory_task, self._status_task):
            if task and not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

    async def _publish_memory_loop(self) -> None:
        topic_base = self._topic_builder.process_status_topic
        heap_used_topic = f"{topic_base}heap-used"
        heap_total_topic = f"{topic_base}heap-total"
        while self._running:
            current, peak = tracemalloc.get_traced_memory()
            time = datetime.utcnow()
            heap_used = round(current / 1048576)
            heap_total = round(peak / 1048576)
            heap_used_packet = UnsPacket.data(
                value=heap_used,
                uom="MB",
                time=time,
            )
            heap_total_packet = UnsPacket.data(
                value=heap_total,
                uom="MB",
                time=time,
            )
            await self._client.publish_raw(heap_used_topic, UnsPacket.to_json(heap_used_packet))
            await self._client.publish_raw(heap_total_topic, UnsPacket.to_json(heap_total_packet))
            await asyncio.sleep(self._interval_s)

    async def _publish_active_loop(self) -> None:
        topic = self._topic_builder.active_topic()
        while self._running:
            time = datetime.utcnow()
            active_packet = UnsPacket.data(
                value=1 if self._active_supplier() else 0,
                uom="bit",
                time=time,
            )
            await self._client.publish_raw(topic, UnsPacket.to_json(active_packet))
            await asyncio.sleep(self._interval_s)
