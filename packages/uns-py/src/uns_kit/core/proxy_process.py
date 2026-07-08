from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass
from typing import Any, List, Mapping, Optional

from ..api.proxy import ApiProxyOptions, UnsApiProxy
from ..cron.proxy import CronProxyOptions, CronScheduleInput, UnsCronProxy
from ..version import __version__
from .client import UnsMqttClient
from .runtime_metadata import RUNTIME_METADATA
from .status_monitor import StatusMonitor
from .topic_builder import TopicBuilder
from .uns_mqtt_proxy import UnsMqttProxy


def _pick(mapping: Mapping[str, Any], snake: str, camel: str) -> Any:
    if snake in mapping:
        return mapping.get(snake)
    return mapping.get(camel)


def _resolve_tls(mqtt_ssl: Optional[bool]) -> bool:
    return bool(mqtt_ssl)


def _resolve_port(port: Optional[int]) -> int:
    return int(port) if port is not None else 1883


@dataclass
class UnsParameters:
    username: Optional[str] = None
    password: Optional[str] = None
    mqtt_ssl: Optional[bool] = None
    client_id: Optional[str] = None
    port: Optional[int] = None
    keepalive: Optional[int] = None
    clean: Optional[bool] = None
    reconnect_period: Optional[int] = None
    publish_concurrency: Optional[int] = None
    max_pending_publishes: Optional[int] = None

    @staticmethod
    def from_mapping(mapping: Mapping[str, Any]) -> "UnsParameters":
        return UnsParameters(
            username=mapping.get("username"),
            password=mapping.get("password"),
            mqtt_ssl=_pick(mapping, "mqtt_ssl", "mqttSSL"),
            client_id=_pick(mapping, "client_id", "clientId"),
            port=mapping.get("port"),
            keepalive=mapping.get("keepalive"),
            clean=mapping.get("clean"),
            reconnect_period=_pick(mapping, "reconnect_period", "reconnectPeriod"),
            publish_concurrency=_pick(mapping, "publish_concurrency", "publishConcurrency"),
            max_pending_publishes=_pick(mapping, "max_pending_publishes", "maxPendingPublishes"),
        )


@dataclass
class UnsProcessParameters:
    process_name: str
    username: Optional[str] = None
    password: Optional[str] = None
    mqtt_ssl: Optional[bool] = None
    client_id: Optional[str] = None
    port: Optional[int] = None
    keepalive: Optional[int] = None
    clean: Optional[bool] = None
    reconnect_period: Optional[int] = None
    package_name: Optional[str] = None
    package_version: Optional[str] = None

    @staticmethod
    def from_mapping(mapping: Mapping[str, Any]) -> "UnsProcessParameters":
        process_name = _pick(mapping, "process_name", "processName")
        if not process_name:
            raise ValueError("UnsProxyProcess requires process_name/processName.")
        return UnsProcessParameters(
            process_name=str(process_name),
            username=mapping.get("username"),
            password=mapping.get("password"),
            mqtt_ssl=_pick(mapping, "mqtt_ssl", "mqttSSL"),
            client_id=_pick(mapping, "client_id", "clientId"),
            port=mapping.get("port"),
            keepalive=mapping.get("keepalive"),
            clean=mapping.get("clean"),
            reconnect_period=_pick(mapping, "reconnect_period", "reconnectPeriod"),
            package_name=_pick(mapping, "package_name", "packageName"),
            package_version=_pick(mapping, "package_version", "packageVersion"),
        )


class UnsProxyProcess:
    """
    Minimal Python equivalent of the TS UnsProxyProcess.
    Manages process-level status publishing and creates instance proxies.
    """

    def __init__(
        self,
        host: str,
        process_parameters: UnsProcessParameters | Mapping[str, Any],
        process_name: Optional[str] = None,
        activate_delay_s: float = 10.0,
    ) -> None:
        if isinstance(process_parameters, UnsProcessParameters):
            self.process_parameters = process_parameters
            if process_name:
                self.process_parameters.process_name = process_name
        else:
            self.process_parameters = UnsProcessParameters.from_mapping(process_parameters)
            if process_name:
                self.process_parameters.process_name = process_name

        self.process_name = self.process_parameters.process_name
        self.process_parameters.package_name = (
            self.process_parameters.package_name
            or RUNTIME_METADATA.package_name
            or "uns-kit"
        )
        self.process_parameters.package_version = (
            self.process_parameters.package_version
            or RUNTIME_METADATA.package_version
            or __version__
        )
        self.process_id = uuid.uuid4().hex
        self.active = False
        self._activate_delay_s = activate_delay_s
        self.topic_builder = TopicBuilder(
            self.process_parameters.package_name,
            self.process_parameters.package_version,
            self.process_name,
        )
        if self.process_parameters.client_id:
            process_client_id = f"{self.process_parameters.client_id}-{self.process_id}"
        else:
            process_client_id = f"{self.process_name}-{self.process_id}"
        reconnect_interval_s = (
            (self.process_parameters.reconnect_period / 1000)
            if self.process_parameters.reconnect_period is not None
            else 2.0
        )
        self._client = UnsMqttClient(
            host,
            port=_resolve_port(self.process_parameters.port),
            username=self.process_parameters.username or None,
            password=self.process_parameters.password or None,
            tls=_resolve_tls(self.process_parameters.mqtt_ssl),
            client_id=process_client_id,
            keepalive=self.process_parameters.keepalive or 60,
            clean_session=True if self.process_parameters.clean is None else self.process_parameters.clean,
            topic_builder=self.topic_builder,
            enable_status=False,
            reconnect_interval=reconnect_interval_s,
        )
        self._status_monitor = StatusMonitor(self._client, self.topic_builder, lambda: self.active)
        self._proxies: List[UnsMqttProxy] = []
        self._api_proxies: List[UnsApiProxy] = []
        self._cron_proxies: List[UnsCronProxy] = []
        self._activate_task: Optional[asyncio.Task] = None

    def get_process_name(self) -> str:
        return self.process_name

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
        for proxy in list(self._proxies):
            await proxy.close()
        self._proxies.clear()
        for proxy in list(self._api_proxies):
            await proxy.stop()
        self._api_proxies.clear()
        for proxy in list(self._cron_proxies):
            await proxy.stop()
        self._cron_proxies.clear()
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
        params = UnsParameters(
            username=username,
            password=password,
            mqtt_ssl=tls,
            client_id=client_id,
            port=port,
        )
        return await self.create_uns_mqtt_proxy(
            host or self._client.host,
            instance_name,
            "wait",
            True,
            params,
        )

    async def create_uns_mqtt_proxy(
        self,
        mqtt_host: str,
        instance_name: str,
        instance_mode: str = "wait",
        handover: bool = True,
        uns_parameters: Optional[UnsParameters | Mapping[str, Any]] = None,
    ) -> UnsMqttProxy:
        # Kept for TS API parity. Python runtime currently does not implement handover manager semantics.
        if instance_mode == "force":
            self.active = True
        _ = handover

        params = (
            UnsParameters.from_mapping(uns_parameters)
            if isinstance(uns_parameters, Mapping)
            else (uns_parameters or UnsParameters())
        )

        if params.client_id:
            resolved_client_id = params.client_id
        elif self.process_parameters.client_id:
            resolved_client_id = f"{self.process_parameters.client_id}-{instance_name}-{self.process_id}"
        else:
            resolved_client_id = f"{self.process_name}-{instance_name}-{self.process_id}"

        resolved_host = mqtt_host
        if not resolved_host:
            raise ValueError("mqtt_host is required.")

        reconnect_interval_s = (
            (params.reconnect_period / 1000)
            if params.reconnect_period is not None
            else 2.0
        )
        proxy = UnsMqttProxy(
            resolved_host,
            process_name=self.process_name,
            instance_name=instance_name,
            package_name=self.process_parameters.package_name,
            package_version=self.process_parameters.package_version,
            port=_resolve_port(params.port if params.port is not None else self.process_parameters.port),
            username=params.username if params.username is not None else self.process_parameters.username,
            password=params.password if params.password is not None else self.process_parameters.password,
            tls=_resolve_tls(params.mqtt_ssl if params.mqtt_ssl is not None else self.process_parameters.mqtt_ssl),
            client_id=resolved_client_id,
            keepalive=params.keepalive if params.keepalive is not None else (self.process_parameters.keepalive or 60),
            clean_session=params.clean if params.clean is not None else (
                True if self.process_parameters.clean is None else self.process_parameters.clean
            ),
            reconnect_interval=reconnect_interval_s,
            publish_concurrency=params.publish_concurrency if params.publish_concurrency is not None else 32,
            max_pending_publishes=params.max_pending_publishes,
        )
        await proxy.connect()
        self._proxies.append(proxy)
        return proxy

    async def createUnsMqttProxy(
        self,
        mqttHost: str,
        instanceName: str,
        instanceMode: str = "wait",
        handover: bool = True,
        unsParameters: Optional[UnsParameters | Mapping[str, Any]] = None,
    ) -> UnsMqttProxy:
        return await self.create_uns_mqtt_proxy(
            mqttHost,
            instanceName,
            instanceMode,
            handover,
            unsParameters,
        )

    async def createMqttProxy(
        self,
        instanceName: str,
        **kwargs: Any,
    ) -> UnsMqttProxy:
        return await self.create_mqtt_proxy(instanceName, **kwargs)

    async def create_api_proxy(
        self,
        instance_name: str,
        options: Optional[ApiProxyOptions | Mapping[str, Any]] = None,
    ) -> UnsApiProxy:
        proxy = UnsApiProxy(
            self._client,
            process_name=self.process_name,
            instance_name=instance_name,
            topic_builder=self.topic_builder,
            options=options,
        )
        await proxy.start()
        self._api_proxies.append(proxy)
        return proxy

    async def createApiProxy(
        self,
        instanceName: str,
        options: Optional[ApiProxyOptions | Mapping[str, Any]] = None,
    ) -> UnsApiProxy:
        return await self.create_api_proxy(instanceName, options)

    async def create_cron_proxy(
        self,
        cron_input: CronScheduleInput,
        options: Optional[CronProxyOptions | Mapping[str, Any]] = None,
    ) -> UnsCronProxy:
        proxy = UnsCronProxy(cron_input, options)
        await proxy.start()
        self._cron_proxies.append(proxy)
        return proxy

    async def createCrontabProxy(
        self,
        cronInput: CronScheduleInput,
        options: Optional[CronProxyOptions | Mapping[str, Any]] = None,
    ) -> UnsCronProxy:
        return await self.create_cron_proxy(cronInput, options)
