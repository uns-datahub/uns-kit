from __future__ import annotations

import sys
from importlib import import_module
from typing import TYPE_CHECKING

from .config_file import ConfigFile
from .packet import DataPayload, TablePayload, UnsPacket
from .secret_resolver import (
    HostResolverOptions,
    InfisicalResolverOptions,
    SecretResolverOptions,
    resolve_infisical_config,
)
from .topic_builder import TopicBuilder
from .version import __version__

if sys.platform.startswith("win"):
    # aiomqtt (and many asyncio socket integrations) rely on add_reader/add_writer,
    # which are not implemented by the default Proactor loop on Windows.
    # Setting the selector policy early fixes this for asyncio.run().
    try:
        import asyncio

        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:  # pragma: no cover
        pass

if TYPE_CHECKING:
    from .proxy_process import UnsParameters, UnsProcessParameters, UnsProxyProcess
    from .status_monitor import StatusMonitor
    from .uns_mqtt_proxy import MessageMode, UnsMqttProxy
    from .client import UnsMqttClient

__all__ = [
    "TopicBuilder",
    "UnsPacket",
    "DataPayload",
    "TablePayload",
    "ConfigFile",
    "SecretResolverOptions",
    "InfisicalResolverOptions",
    "HostResolverOptions",
    "resolve_infisical_config",
    "__version__",
    "UnsMqttClient",
    "StatusMonitor",
    "UnsMqttProxy",
    "MessageMode",
    "UnsProxyProcess",
    "UnsProcessParameters",
    "UnsParameters",
    "client",  # for backward compatibility
]

_LAZY_EXPORTS: dict[str, tuple[str, str]] = {
    "UnsMqttClient": ("uns_kit.client", "UnsMqttClient"),
    "StatusMonitor": ("uns_kit.status_monitor", "StatusMonitor"),
    "UnsMqttProxy": ("uns_kit.uns_mqtt_proxy", "UnsMqttProxy"),
    "MessageMode": ("uns_kit.uns_mqtt_proxy", "MessageMode"),
    "UnsProxyProcess": ("uns_kit.proxy_process", "UnsProxyProcess"),
    "UnsProcessParameters": ("uns_kit.proxy_process", "UnsProcessParameters"),
    "UnsParameters": ("uns_kit.proxy_process", "UnsParameters"),
}


def __getattr__(name: str):
    if name == "client":
        # Backward compatibility: some code expects `uns_kit.client`.
        module = import_module("uns_kit.client")
        globals()[name] = module
        return module
    target = _LAZY_EXPORTS.get(name)
    if not target:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    module_path, attr = target
    module = import_module(module_path)
    value = getattr(module, attr)
    globals()[name] = value
    return value
