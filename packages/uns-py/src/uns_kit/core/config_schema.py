from __future__ import annotations

import importlib.util
import json
from copy import deepcopy
from pathlib import Path
from types import ModuleType
from typing import Any, Dict, Optional


JsonSchema = Dict[str, Any]


def strict_object(
    properties: Optional[Dict[str, Any]] = None,
    *,
    required: Optional[list[str]] = None,
    description: Optional[str] = None,
) -> JsonSchema:
    schema: JsonSchema = {
        "type": "object",
        "properties": properties or {},
        "additionalProperties": False,
    }
    if required:
        schema["required"] = required
    if description:
        schema["description"] = description
    return schema


def string_schema(
    *,
    min_length: Optional[int] = None,
    fmt: Optional[str] = None,
    description: Optional[str] = None,
    default: Optional[str] = None,
    enum: Optional[list[str]] = None,
) -> JsonSchema:
    schema: JsonSchema = {"type": "string"}
    if min_length is not None:
        schema["minLength"] = min_length
    if fmt:
        schema["format"] = fmt
    if description:
        schema["description"] = description
    if default is not None:
        schema["default"] = default
    if enum:
        schema["enum"] = enum
    return schema


def integer_schema(
    *,
    minimum: Optional[int] = None,
    exclusive_minimum: Optional[int] = None,
    description: Optional[str] = None,
    default: Optional[int] = None,
) -> JsonSchema:
    schema: JsonSchema = {"type": "integer"}
    if minimum is not None:
        schema["minimum"] = minimum
    if exclusive_minimum is not None:
        schema["exclusiveMinimum"] = exclusive_minimum
    if description:
        schema["description"] = description
    if default is not None:
        schema["default"] = default
    return schema


def boolean_schema(
    *,
    description: Optional[str] = None,
    default: Optional[bool] = None,
) -> JsonSchema:
    schema: JsonSchema = {"type": "boolean"}
    if description:
        schema["description"] = description
    if default is not None:
        schema["default"] = default
    return schema


def array_schema(
    items: JsonSchema,
    *,
    min_items: Optional[int] = None,
    description: Optional[str] = None,
) -> JsonSchema:
    schema: JsonSchema = {"type": "array", "items": items}
    if min_items is not None:
        schema["minItems"] = min_items
    if description:
        schema["description"] = description
    return schema


def enum_schema(values: list[str], *, description: Optional[str] = None, default: Optional[str] = None) -> JsonSchema:
    return string_schema(description=description, default=default, enum=values)


def record_schema(value_schema: JsonSchema, *, description: Optional[str] = None) -> JsonSchema:
    schema: JsonSchema = {
        "type": "object",
        "additionalProperties": value_schema,
    }
    if description:
        schema["description"] = description
    return schema


def any_of(*schemas: JsonSchema, description: Optional[str] = None) -> JsonSchema:
    result: JsonSchema = {"anyOf": list(schemas)}
    if description:
        result["description"] = description
    return result


def _literal_string(value: str, *, description: Optional[str] = None) -> JsonSchema:
    schema: JsonSchema = {"const": value, "type": "string"}
    if description:
        schema["description"] = description
    return schema


host_placeholder_schema = {
    "oneOf": [
        strict_object(
            {
                "provider": _literal_string("inline", description="Use the supplied host or IP address."),
                "value": string_schema(
                    min_length=1,
                    description="Host or IP address that should be used directly.",
                ),
            },
            required=["provider", "value"],
            description="Host placeholder resolved from an in-line value.",
        ),
        strict_object(
            {
                "provider": _literal_string("external", description="Resolve the host from an external mapping."),
                "key": string_schema(
                    min_length=1,
                    description="Identifier used when resolving the host from HostResolverOptions.",
                ),
                "optional": boolean_schema(
                    description="Allow the external host to be missing without throwing during resolution.",
                ),
                "default": string_schema(
                    description="Fallback host when optional is true and the external entry is missing.",
                ),
            },
            required=["provider", "key"],
            description="Host placeholder resolved via HostResolverOptions.externalHosts or resolveExternal function.",
        ),
        strict_object(
            {
                "provider": _literal_string("system", description="Resolve the host from local network interfaces."),
                "family": enum_schema(
                    ["IPv4", "IPv6"],
                    default="IPv4",
                    description="Address family to return when scanning interfaces.",
                ),
                "interfaceName": string_schema(
                    description="Specific interface to read (falls back to the first match when omitted).",
                ),
                "optional": boolean_schema(
                    description="Allow the interface lookup to fail without throwing during resolution.",
                ),
                "default": string_schema(
                    description="Fallback host/IP when optional is true and no interface matches.",
                ),
            },
            required=["provider"],
            description="Host placeholder resolved from os.networkInterfaces().",
        ),
    ]
}

host_value_schema = any_of(
    string_schema(
        min_length=1,
        description="Host or IP address used directly without placeholder.",
    ),
    host_placeholder_schema,
)

secret_placeholder_schema = {
    "oneOf": [
        strict_object(
            {
                "provider": _literal_string("env", description="Load the secret from an environment variable."),
                "key": string_schema(
                    min_length=1,
                    description="Name of the environment variable to read.",
                ),
                "optional": boolean_schema(
                    description="Allow the variable to be absent without throwing during resolution.",
                ),
                "default": string_schema(
                    description="Fallback value when optional is true and the variable is missing.",
                ),
            },
            required=["provider", "key"],
            description="Secret placeholder resolved from process.env.",
        ),
        strict_object(
            {
                "provider": _literal_string("infisical", description="Load the secret from Infisical."),
                "path": string_schema(
                    min_length=1,
                    description="Secret folder path in Infisical, e.g. '/app/database'.",
                ),
                "key": string_schema(
                    min_length=1,
                    description="Secret key/name inside the given path.",
                ),
                "optional": boolean_schema(
                    description="Allow the secret to be absent without throwing during resolution.",
                ),
                "environment": string_schema(
                    description="Infisical environment override (defaults to current mode if omitted).",
                ),
                "projectId": string_schema(
                    description="Optional Infisical project identifier when not using the default.",
                ),
                "default": string_schema(
                    description="Fallback value when the secret is missing and optional resolution is allowed.",
                ),
            },
            required=["provider", "path", "key"],
            description="Secret placeholder resolved from Infisical.",
        ),
    ]
}

secret_value_schema = any_of(
    string_schema(),
    secret_placeholder_schema,
)

_mqtt_protocol_schema = enum_schema(["mqtt", "mqtts", "ws", "wss", "tcp", "ssl"])

_supervisor_schema = strict_object(
    {
        "enabled": boolean_schema(
            default=False,
            description="Enable controller/PM2 supervisor handling for this RTT instance.",
        ),
        "restartOnExit": boolean_schema(
            default=False,
            description="Let PM2 restart the process when it exits unexpectedly.",
        ),
        "maxMemoryMb": integer_schema(
            exclusive_minimum=0,
            description="Optional PM2 memory restart limit in megabytes.",
        ),
        "restartOnUnhealthy": boolean_schema(
            default=False,
            description="Let the controller auto-start this instance when required system-service runtime signals are absent.",
        ),
        "unhealthyAfterMs": integer_schema(
            exclusive_minimum=0,
            default=60_000,
            description="How long runtime signals must stay unhealthy before the controller supervisor can act.",
        ),
        "restartCooldownMs": integer_schema(
            exclusive_minimum=0,
            default=300_000,
            description="Minimum time between controller supervisor restart attempts for this instance.",
        ),
    },
    description="Optional PM2/controller supervisor guard settings for this RTT instance.",
)

_mqtt_server_schema = strict_object(
    {
        "host": host_value_schema,
        "port": integer_schema(exclusive_minimum=0),
        "protocol": _mqtt_protocol_schema,
    },
    required=["host"],
)

_mqtt_connect_properties_schema = strict_object(
    {
        "sessionExpiryInterval": integer_schema(minimum=0),
        "receiveMaximum": integer_schema(exclusive_minimum=0),
        "maximumPacketSize": integer_schema(exclusive_minimum=0),
        "topicAliasMaximum": integer_schema(minimum=0),
        "requestResponseInformation": boolean_schema(),
        "requestProblemInformation": boolean_schema(),
        "userProperties": record_schema(string_schema()),
    }
)

_mqtt_channel_schema = strict_object(
    {
        "host": host_value_schema,
        "hosts": array_schema(host_value_schema, min_items=1),
        "servers": array_schema(_mqtt_server_schema, min_items=1),
        "port": integer_schema(exclusive_minimum=0),
        "protocol": _mqtt_protocol_schema,
        "username": string_schema(),
        "password": secret_value_schema,
        "clientId": string_schema(),
        "clean": boolean_schema(),
        "keepalive": integer_schema(minimum=0),
        "connectTimeout": integer_schema(minimum=0),
        "reconnectPeriod": integer_schema(minimum=0),
        "reconnectOnConnackError": boolean_schema(),
        "resubscribe": boolean_schema(),
        "queueQoSZero": boolean_schema(),
        "rejectUnauthorized": boolean_schema(),
        "properties": _mqtt_connect_properties_schema,
        "ca": string_schema(),
        "cert": string_schema(),
        "key": string_schema(),
        "servername": string_schema(),
        "tls": boolean_schema(),
        "mqttSubToTopics": array_schema(string_schema()),
    },
    description="One of host, hosts, or servers must be provided.",
)
_mqtt_channel_schema["anyOf"] = [
    {"required": ["host"]},
    {"required": ["hosts"]},
    {"required": ["servers"]},
]

base_config_schema = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "AppConfig",
    **strict_object(
        {
            "$schema": string_schema(
                description="Optional local schema reference used by editors.",
            ),
            "uns": strict_object(
                {
                    "graphql": string_schema(fmt="uri"),
                    "rest": string_schema(fmt="uri"),
                    "token": any_of(
                        secret_value_schema,
                        description="Bearer token used for service-to-service access to the UNS instance.",
                    ),
                    "email": string_schema(
                        fmt="email",
                        description="Email used when authenticating to graphql endpoint of the UNS instance.",
                    ),
                    "password": any_of(
                        secret_value_schema,
                        description="Password or secret value paired with the UNS email.",
                    ),
                    "instanceMode": enum_schema(["wait", "force", "handover"], default="wait"),
                    "processName": string_schema(
                        min_length=1,
                        description="Process name used in MQTT topics and logs.",
                    ),
                    "handover": boolean_schema(default=True),
                    "supervisor": _supervisor_schema,
                    "jwksWellKnownUrl": string_schema(fmt="uri"),
                    "kidWellKnownUrl": string_schema(fmt="uri"),
                    "env": enum_schema(["dev", "staging", "test", "prod"], default="dev"),
                },
                required=["graphql", "rest", "processName"],
            ),
            "logging": strict_object(
                {
                    "adapter": string_schema(min_length=1, default="udp"),
                    "host": host_value_schema,
                    "port": integer_schema(exclusive_minimum=0, default=12201),
                    "level": enum_schema(
                        ["error", "warn", "info", "http", "verbose", "debug", "silly"],
                        default="info",
                    ),
                },
                required=["host"],
            ),
            "input": _mqtt_channel_schema,
            "output": _mqtt_channel_schema,
            "infra": _mqtt_channel_schema,
            "devops": strict_object(
                {
                    "provider": enum_schema(["azure-devops"], default="azure-devops"),
                    "organization": string_schema(min_length=1),
                    "project": string_schema(min_length=1),
                },
                required=["organization"],
            ),
        },
        required=["uns", "infra"],
    ),
}

DEFAULT_PROJECT_EXTENSION_PATH = Path("src/config/project_config_extension.py")


def compose_config_schema(project_extras_schema: Optional[JsonSchema]) -> JsonSchema:
    combined = deepcopy(base_config_schema)
    if not project_extras_schema:
        return combined

    if project_extras_schema.get("type") != "object":
        raise ValueError("project_extras_schema must be a JSON schema object with type='object'.")

    root_properties = combined.setdefault("properties", {})
    root_required = set(combined.get("required", []))

    for key, value in project_extras_schema.get("properties", {}).items():
        root_properties[key] = value

    for key in project_extras_schema.get("required", []):
        root_required.add(key)

    if root_required:
        combined["required"] = sorted(root_required)

    return combined


def load_project_extras_schema(project_root: Path) -> JsonSchema:
    extension_path = project_root / DEFAULT_PROJECT_EXTENSION_PATH
    if not extension_path.exists():
        return strict_object({})

    module = _load_extension_module(extension_path)
    schema = getattr(module, "project_extras_schema", None)
    if schema is None:
        raise ValueError(f"{extension_path} does not export project_extras_schema.")
    if not isinstance(schema, dict):
        raise ValueError(f"{extension_path} exports project_extras_schema, but it is not a dict.")
    return schema


def generate_config_schema(project_root: Path) -> Path:
    project_root = project_root.resolve()
    schema = compose_config_schema(load_project_extras_schema(project_root))
    output_path = project_root / "config.schema.json"
    output_path.write_text(json.dumps(schema, indent=2) + "\n", encoding="utf-8")
    return output_path


def _load_extension_module(extension_path: Path) -> ModuleType:
    spec = importlib.util.spec_from_file_location("uns_kit_project_config_extension", extension_path)
    if spec is None or spec.loader is None:
        raise ValueError(f"Unable to load {extension_path}.")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
