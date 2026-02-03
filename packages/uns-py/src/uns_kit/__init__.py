from __future__ import annotations

from importlib import import_module
from typing import TYPE_CHECKING

from .config import UnsConfig
from .packet import DataPayload, TablePayload, UnsPacket
from .topic_builder import TopicBuilder
from .version import __version__

if TYPE_CHECKING:
    # These import optional runtime deps (asyncio-mqtt/paho). Keep them lazy at runtime
    # so non-MQTT CLI commands (create/configure-devops/pull-request) don't print warnings
    # or fail import when MQTT deps are missing.
    from .client import UnsMqttClient
    from .proxy_process import UnsProxyProcess
    from .status_monitor import StatusMonitor
    from .uns_mqtt_proxy import MessageMode, UnsMqttProxy

__all__ = [
    "TopicBuilder",
    "UnsPacket",
    "DataPayload",
    "TablePayload",
    "UnsConfig",
    "__version__",
    "UnsMqttClient",
    "StatusMonitor",
    "UnsMqttProxy",
    "MessageMode",
    "UnsProxyProcess",
]


_LAZY_EXPORTS: dict[str, tuple[str, str]] = {
    "UnsMqttClient": ("uns_kit.client", "UnsMqttClient"),
    "StatusMonitor": ("uns_kit.status_monitor", "StatusMonitor"),
    "UnsMqttProxy": ("uns_kit.uns_mqtt_proxy", "UnsMqttProxy"),
    "MessageMode": ("uns_kit.uns_mqtt_proxy", "MessageMode"),
    "UnsProxyProcess": ("uns_kit.proxy_process", "UnsProxyProcess"),
}


def __getattr__(name: str):
    target = _LAZY_EXPORTS.get(name)
    if not target:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    module_path, attr = target
    module = import_module(module_path)
    value = getattr(module, attr)
    globals()[name] = value
    return value
