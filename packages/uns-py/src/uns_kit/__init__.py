from __future__ import annotations

import sys
from importlib import import_module
from typing import TYPE_CHECKING

from .config import UnsConfig
from .packet import DataPayload, TablePayload, UnsPacket
from .topic_builder import TopicBuilder
from .version import __version__

# Windows default (Proactor) loop lacks add_reader, which asyncio-mqtt needs.
# Switch to Selector loop policy early when running on Windows.
if sys.platform.startswith("win"):
    try:
        import asyncio

        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:  # pragma: no cover
        pass

if TYPE_CHECKING:
    from .proxy_process import UnsProxyProcess
    from .status_monitor import StatusMonitor
    from .uns_mqtt_proxy import MessageMode, UnsMqttProxy
    from .client import UnsMqttClient

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
    "client",  # for backward compatibility
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
