from __future__ import annotations

import sys
from importlib import import_module
from typing import TYPE_CHECKING

from .config_file import ConfigFile
from .config_schema import (
    base_config_schema,
    boolean_schema,
    compose_config_schema,
    generate_config_schema,
    host_value_schema,
    integer_schema,
    load_project_extras_schema,
    secret_value_schema,
    strict_object,
    string_schema,
)
from .packet import DataPayload, TablePayload, UnsPacket
from .runtime_metadata import RUNTIME_METADATA
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
    from .auth_client import AuthClient
    from .api_proxy import ApiEventContext, ApiProxyOptions, GetEndpointOptions, PostEndpointOptions, QueryParamDef, UnsApiProxy
    from .cron_proxy import CronProxyOptions, CronSchedule, UnsCronProxy
    from .datahub_client import BatchRangeResponse, BatchRangeTopicResult, LastValueClientError, LastValueResult, RangeResult, UnsClient
    from .proxy_process import UnsParameters, UnsProcessParameters, UnsProxyProcess
    from .status_monitor import StatusMonitor
    from .uns_mqtt_proxy import MessageMode, UnsMqttProxy
    from .client import UnsMqttClient
    from .uns_path import build_uns_identity_path, build_uns_route_path

__all__ = [
    "TopicBuilder",
    "UnsPacket",
    "DataPayload",
    "TablePayload",
    "ConfigFile",
    "base_config_schema",
    "compose_config_schema",
    "generate_config_schema",
    "load_project_extras_schema",
    "strict_object",
    "string_schema",
    "integer_schema",
    "boolean_schema",
    "host_value_schema",
    "secret_value_schema",
    "RUNTIME_METADATA",
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
    "UnsApiProxy",
    "ApiProxyOptions",
    "GetEndpointOptions",
    "PostEndpointOptions",
    "QueryParamDef",
    "ApiEventContext",
    "UnsCronProxy",
    "CronProxyOptions",
    "CronSchedule",
    "UnsClient",
    "AuthClient",
    "RangeResult",
    "BatchRangeTopicResult",
    "BatchRangeResponse",
    "LastValueResult",
    "LastValueClientError",
    "build_uns_identity_path",
    "build_uns_route_path",
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
    "UnsApiProxy": ("uns_kit.api_proxy", "UnsApiProxy"),
    "ApiProxyOptions": ("uns_kit.api_proxy", "ApiProxyOptions"),
    "GetEndpointOptions": ("uns_kit.api_proxy", "GetEndpointOptions"),
    "PostEndpointOptions": ("uns_kit.api_proxy", "PostEndpointOptions"),
    "QueryParamDef": ("uns_kit.api_proxy", "QueryParamDef"),
    "ApiEventContext": ("uns_kit.api_proxy", "ApiEventContext"),
    "UnsCronProxy": ("uns_kit.cron_proxy", "UnsCronProxy"),
    "CronProxyOptions": ("uns_kit.cron_proxy", "CronProxyOptions"),
    "CronSchedule": ("uns_kit.cron_proxy", "CronSchedule"),
    "UnsClient": ("uns_kit.datahub_client", "UnsClient"),
    "AuthClient": ("uns_kit.auth_client", "AuthClient"),
    "RangeResult": ("uns_kit.datahub_client", "RangeResult"),
    "BatchRangeTopicResult": ("uns_kit.datahub_client", "BatchRangeTopicResult"),
    "BatchRangeResponse": ("uns_kit.datahub_client", "BatchRangeResponse"),
    "LastValueResult": ("uns_kit.datahub_client", "LastValueResult"),
    "LastValueClientError": ("uns_kit.datahub_client", "LastValueClientError"),
    "build_uns_identity_path": ("uns_kit.uns_path", "build_uns_identity_path"),
    "build_uns_route_path": ("uns_kit.uns_path", "build_uns_route_path"),
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
