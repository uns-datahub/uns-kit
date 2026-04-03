from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from .client import UnsMqttClient
from .packet import isoformat


class UnsProxy:
    """
    Base proxy that tracks produced topics and periodically publishes the registry.
    """

    def __init__(self, client: UnsMqttClient, instance_status_topic: str, instance_name: str) -> None:
        self._client = client
        self._instance_status_topic = instance_status_topic
        self._instance_name = instance_name
        self._produced_topics: Dict[str, Dict[str, Any]] = {}
        self._publish_task: Optional[asyncio.Task] = None
        self._running = False

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._publish_task = asyncio.create_task(self._publish_loop())

    async def stop(self) -> None:
        self._running = False
        if self._publish_task and not self._publish_task.done():
            self._publish_task.cancel()
            try:
                await self._publish_task
            except asyncio.CancelledError:
                pass

    async def _publish_loop(self) -> None:
        while self._running:
            await self._emit_produced_topics()
            await asyncio.sleep(60)

    async def _emit_produced_topics(self) -> None:
        if not self._produced_topics:
            return
        payload = json.dumps(list(self._produced_topics.values()), separators=(",", ":"))
        await self._client.publish_raw(
            f"{self._instance_status_topic}topics",
            payload,
            retain=True,
        )

    async def register_unique_topic(self, topic_object: Dict[str, Any]) -> None:
        asset = topic_object.get("asset") or ""
        object_type = topic_object.get("objectType") or ""
        object_id = topic_object.get("objectId") or ""
        attribute = topic_object.get("attribute") or ""
        full_topic = f"{topic_object.get('topic', '')}{asset}/{object_type}/{object_id}/{attribute}"
        if full_topic not in self._produced_topics:
            topic_object.setdefault("timestamp", isoformat(datetime.now(timezone.utc)))
            self._produced_topics[full_topic] = topic_object
            await self._emit_produced_topics()
