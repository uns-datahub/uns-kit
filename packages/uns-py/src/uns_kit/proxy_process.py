from __future__ import annotations

import asyncio
import uuid
from typing import List, Optional

from .client import UnsMqttClient
from .config import UnsConfig
from .status_monitor import StatusMonitor
from .topic_builder import TopicBuilder
from .uns_mqtt_proxy import UnsMqttProxy


class UnsProxyProcess:
    """
    Minimal Python equivalent of the TS UnsProxyProcess.
    Manages process-level status publishing and creates instance proxies.
    """

    def __init__(self, host: str, config: UnsConfig, process_name: Optional[str] = None, activate_delay_s: float = 10.0) -> None:
        self.config = config
        self.process_name = process_name or config.process_name
        self.process_id = uuid.uuid4().hex
        self.active = False
        self._activate_delay_s = activate_delay_s
        self.topic_builder = TopicBuilder(config.package_name, config.package_version, self.process_name)
        self._client = UnsMqttClient(
            host,
            port=config.port,
            username=config.username or None,
            password=config.password or None,
            tls=config.tls,
            client_id=config.client_id,
            keepalive=config.keepalive,
            clean_session=config.clean_session,
            topic_builder=self.topic_builder,
            enable_status=False,
        )
        self._status_monitor = StatusMonitor(self._client, self.topic_builder, lambda: self.active)
        self._proxies: List[UnsMqttProxy] = []
        self._activate_task: Optional[asyncio.Task] = None

    async def start(self) -> None:
        await self._client.connect()
        await self._status_monitor.start()
        if self._activate_task is None or self._activate_task.done():
            self._activate_task = asyncio.create_task(self._activate_after_delay())

    async def stop(self) -> None:
        if self._activate_task and not self._activate_task.done():
            self._activate_task.cancel()
            try:
                await self._activate_task
            except asyncio.CancelledError:
                pass
        await self._status_monitor.stop()
        await self._client.close()

    def set_active(self, active: bool) -> None:
        self.active = active

    async def _activate_after_delay(self) -> None:
        await asyncio.sleep(self._activate_delay_s)
        if not self.active:
            self.active = True

    async def create_mqtt_proxy(
        self,
        instance_name: str,
        *,
        host: Optional[str] = None,
        port: Optional[int] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        tls: Optional[bool] = None,
        client_id: Optional[str] = None,
    ) -> UnsMqttProxy:
        proxy = UnsMqttProxy(
            host or self.config.host,
            process_name=self.process_name,
            instance_name=instance_name,
            package_name=self.config.package_name,
            package_version=self.config.package_version,
            port=port if port is not None else self.config.port,
            username=username if username is not None else self.config.username,
            password=password if password is not None else self.config.password,
            tls=tls if tls is not None else self.config.tls,
            client_id=client_id,
        )
        await proxy.connect()
        self._proxies.append(proxy)
        return proxy
