from __future__ import annotations

import asyncio
import contextlib
from contextlib import asynccontextmanager
from typing import AsyncIterator, List, Optional

from asyncio_mqtt import Client, MqttError, Message, Will

from .packet import UnsPacket
from .topic_builder import TopicBuilder


class UnsMqttClient:
    def __init__(
        self,
        host: str,
        *,
        topic_builder: TopicBuilder,
        port: Optional[int] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        client_id: Optional[str] = None,
        tls: bool = False,
        keepalive: int = 60,
        clean_session: bool = True,
        reconnect_interval: float = 2.0,
        max_reconnect_interval: float = 30.0,
    ):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.client_id = client_id
        self.tls = tls
        self.keepalive = keepalive
        self.clean_session = clean_session
        self.reconnect_interval = reconnect_interval
        self.max_reconnect_interval = max_reconnect_interval
        self.topic_builder = topic_builder
        self._client: Optional[Client] = None
        self._status_task: Optional[asyncio.Task] = None
        self._connected = asyncio.Event()
        self._closing = False
        self._connect_lock = asyncio.Lock()

    async def _connect_once(self) -> None:
        will = Will(
            topic=f"{self.topic_builder.process_status_topic}alive",
            payload=b"",
            qos=0,
            retain=True,
        )
        kwargs = {
            "hostname": self.host,
            "port": self.port,
            "username": self.username,
            "password": self.password,
            "client_id": self.client_id,
            "keepalive": self.keepalive,
            "clean_session": self.clean_session,
            "will": will,
        }
        if self.tls:
            try:
                import ssl
                kwargs["tls_context"] = ssl.create_default_context()
            except Exception:
                # Fall back to plain connection if TLS context cannot be created
                pass
        try:
            client = Client(**kwargs)
        except TypeError:
            kwargs.pop("tls_context", None)
            client = Client(**kwargs)
        await client.connect()
        self._client = client
        self._connected.set()

    async def _ensure_connected(self) -> None:
        if self._connected.is_set():
            return
        async with self._connect_lock:
            if self._connected.is_set():
                return
            backoff = self.reconnect_interval
            while not self._closing:
                try:
                    await self._connect_once()
                    if not self._status_task or self._status_task.done():
                        self._status_task = asyncio.create_task(self._publish_status_loop())
                    return
                except MqttError:
                    await asyncio.sleep(backoff)
                    backoff = min(backoff * 2, self.max_reconnect_interval)

    async def connect(self) -> None:
        await self._ensure_connected()

    async def close(self) -> None:
        self._closing = True
        if self._status_task:
            self._status_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._status_task
        if self._client:
            with contextlib.suppress(Exception):
                await self._client.disconnect()
        self._connected.clear()

    async def publish_raw(self, topic: str, payload: str | bytes, *, qos: int = 0, retain: bool = False) -> None:
        await self._ensure_connected()
        for attempt in range(2):
            try:
                assert self._client
                await self._client.publish(topic, payload, qos=qos, retain=retain)
                return
            except MqttError:
                self._connected.clear()
                if attempt == 0:
                    await self._ensure_connected()
                else:
                    raise

    async def publish_packet(self, topic: str, packet: dict, *, qos: int = 0, retain: bool = False) -> None:
        payload = UnsPacket.to_json(packet)
        await self.publish_raw(topic, payload, qos=qos, retain=retain)

    @asynccontextmanager
    async def messages(self, topics: str | List[str]) -> AsyncIterator[AsyncIterator[Message]]:
        await self._ensure_connected()
        assert self._client
        manager = self._client.filtered_messages(topics) if isinstance(topics, str) else self._client.unfiltered_messages()
        async with manager as messages:
            if isinstance(topics, str):
                await self._client.subscribe(topics)
            else:
                for t in topics:
                    await self._client.subscribe(t)
            yield messages

    async def resilient_messages(self, topics: str | List[str]) -> AsyncIterator[Message]:
        """
        Async generator that keeps the subscription alive across disconnects.
        """
        while not self._closing:
            await self._ensure_connected()
            try:
                async with self.messages(topics) as msgs:
                    async for msg in msgs:
                        yield msg
            except MqttError:
                self._connected.clear()
                await asyncio.sleep(self.reconnect_interval)
                continue

    async def _publish_status_loop(self) -> None:
        uptime_topic = f"{self.topic_builder.process_status_topic}uptime"
        alive_topic = f"{self.topic_builder.process_status_topic}alive"
        start = asyncio.get_event_loop().time()
        try:
            while not self._closing:
                now = asyncio.get_event_loop().time()
                uptime_minutes = int((now - start) / 60)
                await self.publish_raw(alive_topic, b"", qos=0, retain=True)
                await self.publish_raw(uptime_topic, str(uptime_minutes).encode(), qos=0, retain=True)
                await asyncio.sleep(10)
        except asyncio.CancelledError:
            pass
