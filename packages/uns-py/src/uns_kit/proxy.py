from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from .client import UnsMqttClient
from .events import EventEmitter
from .packet import isoformat


class UnsProxy:
    """
    Base proxy that tracks produced topics and periodically publishes the registry.
    """

    def __init__(self, client: UnsMqttClient, instance_status_topic: str, instance_name: str) -> None:
        self._client = client
        self._instance_status_topic = instance_status_topic
        self._instance_name = instance_name
        self.event = EventEmitter()
        self._produced_topics: Dict[str, Dict[str, Any]] = {}
        self._produced_api_endpoints: Dict[str, Dict[str, Any]] = {}
        self._produced_api_catchall: Dict[str, Dict[str, Any]] = {}
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
        await self.event.emit(
            "unsProxyProducedTopics",
            {
                "producedTopics": list(self._produced_topics.values()),
                "statusTopic": f"{self._instance_status_topic}topics",
            },
        )
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

    async def _emit_produced_api_endpoints(self) -> None:
        await self.event.emit(
            "unsProxyProducedApiEndpoints",
            {
                "producedApiEndpoints": list(self._produced_api_endpoints.values()),
                "statusTopic": f"{self._instance_status_topic}api",
            },
        )
        payload = json.dumps(list(self._produced_api_endpoints.values()), separators=(",", ":"))
        await self._client.publish_raw(f"{self._instance_status_topic}api", payload, retain=True)

    async def _emit_produced_api_catchall(self) -> None:
        await self.event.emit(
            "unsProxyProducedApiCatchAll",
            {
                "producedCatchall": list(self._produced_api_catchall.values()),
                "statusTopic": f"{self._instance_status_topic}api-catchall",
            },
        )
        payload = json.dumps(list(self._produced_api_catchall.values()), separators=(",", ":"))
        await self._client.publish_raw(f"{self._instance_status_topic}api-catchall", payload, retain=True)

    async def register_api_endpoint(self, api_object: Dict[str, Any]) -> None:
        key = "|".join(
            str(api_object.get(name, ""))
            for name in ("topic", "asset", "objectType", "objectId", "attribute", "apiMethod")
        )
        api_object.setdefault("timestamp", isoformat(datetime.now(timezone.utc)))
        self._produced_api_endpoints[key] = api_object
        await self._emit_produced_api_endpoints()

    async def unregister_api_endpoint(
        self,
        topic: str,
        asset: str,
        object_type: str,
        object_id: str,
        attribute: str,
        method: str,
    ) -> None:
        key = "|".join([topic, asset, object_type, object_id, attribute, method])
        if key in self._produced_api_endpoints:
            del self._produced_api_endpoints[key]
            await self._emit_produced_api_endpoints()

    async def register_api_catchall(self, catchall_object: Dict[str, Any]) -> None:
        topic = str(catchall_object.get("topic", ""))
        self._produced_api_catchall[topic] = catchall_object
        await self._emit_produced_api_catchall()
