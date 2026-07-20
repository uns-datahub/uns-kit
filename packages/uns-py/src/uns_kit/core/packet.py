from __future__ import annotations

from dataclasses import asdict, dataclass, is_dataclass
from datetime import datetime, timezone
import re
from typing import Any, Dict, Literal, Optional, TypeAlias, cast
import json

from .logger import get_logger

log = get_logger(__name__)

DataValue: TypeAlias = str | int | float
TableValue: TypeAlias = DataValue | bool | None
QuestDbPrimitiveType: TypeAlias = Literal[
    "boolean",
    "ipv4",
    "byte",
    "short",
    "char",
    "int",
    "float",
    "symbol",
    "varchar",
    "string",
    "long",
    "date",
    "timestamp",
    "timestamp_ns",
    "double",
    "uuid",
    "binary",
    "long256",
]

QUESTDB_PRIMITIVE_TYPES: set[str] = {
    "boolean",
    "ipv4",
    "byte",
    "short",
    "char",
    "int",
    "float",
    "symbol",
    "varchar",
    "string",
    "long",
    "date",
    "timestamp",
    "timestamp_ns",
    "double",
    "uuid",
    "binary",
    "long256",
}
QUESTDB_GEOHASH_RE = re.compile(r"^geohash\(\d+[bc]\)$")
QUESTDB_DECIMAL_RE = re.compile(r"^decimal\(\d+,\d+\)$")
QUESTDB_ARRAY_RE = re.compile(r"^array<[^>]+>$")
CANONICAL_COLUMN_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,62}$")
RESERVED_COLUMN_NAMES = {"__proto__", "prototype", "constructor"}
SUPPORTED_LEGACY_PACKET_VERSION_RE = re.compile(r"^1\.\d+\.\d+(?:[-+].*)?$")


def isoformat(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


@dataclass
class DataPayload:
    value: DataValue
    uom: Optional[str] = None
    time: Optional[str] = None
    dataGroup: Optional[str] = None
    intervalStart: Optional[str | int] = None
    intervalEnd: Optional[str | int] = None
    windowStart: Optional[str | int] = None
    windowEnd: Optional[str | int] = None
    eventId: Optional[str] = None
    deleted: Optional[bool] = None
    deletedAt: Optional[str | int] = None
    lastSeen: Optional[str | int] = None
    foreignEventKey: Optional[str] = None


@dataclass
class TableColumnPayload:
    type: str
    value: TableValue
    uom: Optional[str] = None
    name: Optional[str] = None


@dataclass
class TablePayload:
    time: str
    columns: Dict[str, TableColumnPayload | Dict[str, Any]]
    dataGroup: Optional[str] = None
    intervalStart: Optional[str | int] = None
    intervalEnd: Optional[str | int] = None
    windowStart: Optional[str | int] = None
    windowEnd: Optional[str | int] = None
    eventId: Optional[str] = None
    deleted: Optional[bool] = None
    deletedAt: Optional[str | int] = None
    lastSeen: Optional[str | int] = None


def _is_data_value(value: Any) -> bool:
    if isinstance(value, bool):
        return False
    return isinstance(value, (str, int, float))


def _is_table_value(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, bool):
        return True
    return isinstance(value, (str, int, float))


def is_questdb_type(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    if value in QUESTDB_PRIMITIVE_TYPES:
        return True
    return bool(
        QUESTDB_GEOHASH_RE.fullmatch(value)
        or QUESTDB_DECIMAL_RE.fullmatch(value)
        or QUESTDB_ARRAY_RE.fullmatch(value)
    )


def _value_type(value: DataValue) -> str:
    if isinstance(value, str):
        return "string"
    if isinstance(value, bool):
        raise ValueError("data.value must be string or number, not boolean")
    if isinstance(value, (int, float)):
        return "number"
    raise ValueError("data.value must be string or number")


def _validate_data_payload(payload: Dict[str, Any]) -> None:
    if "value" not in payload:
        raise ValueError("data payload must include 'value'")
    value = payload["value"]
    if not _is_data_value(value):
        raise ValueError("data.value must be string or number")


def _validate_table_payload(
    payload: Dict[str, Any],
    *,
    require_canonical_names: bool = True,
) -> None:
    columns = payload.get("columns")
    if not isinstance(columns, dict) or len(columns) == 0:
        raise ValueError("table.columns must be a non-empty object")

    for name, raw_column in columns.items():
        _validate_column_name(name, require_canonical=require_canonical_names)
        try:
            column = _coerce_object(raw_column)
        except TypeError as exc:
            raise ValueError(f"table.columns.{name} must be an object") from exc
        if "name" in column:
            raise ValueError(f"table.columns.{name} must not contain a name property")
        _validate_named_column_payload(name, column, f"table.columns.{name}")


def _validate_named_column_payload(
    name: str, column: Dict[str, Any], path: str
) -> None:
    column_type = column.get("type")
    if column_type is None:
        raise ValueError(f"{path}.type is required")
    if not is_questdb_type(column_type):
        raise ValueError(f"{path}.type must be a valid QuestDB type literal")

    if "value" not in column:
        raise ValueError(f"{path}.value is required")
    if not _is_table_value(column["value"]):
        raise ValueError(f"{path}.value must be string, number, boolean, or null")
    if "uom" in column and not isinstance(column["uom"], str):
        raise ValueError(f"{path}.uom must be a string when provided")


def _validate_column_name(name: Any, *, require_canonical: bool) -> str:
    if not isinstance(name, str) or not name.strip():
        raise ValueError("table.columns keys must be non-empty strings")
    if name in RESERVED_COLUMN_NAMES:
        raise ValueError(f"table column name '{name}' is reserved")
    if require_canonical and not CANONICAL_COLUMN_NAME_RE.fullmatch(name):
        raise ValueError(
            f"table column name '{name}' must match {CANONICAL_COLUMN_NAME_RE.pattern}"
        )
    return name


def _coerce_object(value: Any) -> Dict[str, Any]:
    if is_dataclass(value):
        coerced = asdict(cast(Any, value))
    elif isinstance(value, dict):
        coerced = dict(value)
    else:
        raise TypeError("value must be a dict or dataclass")
    return coerced


def _normalize_table_columns(
    columns: Any,
    *,
    legacy_names_may_be_noncanonical: bool = False,
) -> Dict[str, Dict[str, Any]]:
    if isinstance(columns, list):
        if len(columns) == 0:
            raise ValueError("table.columns must be a non-empty array or object")

        normalized: Dict[str, Dict[str, Any]] = {}
        seen_names: set[str] = set()
        for index, raw_column in enumerate(columns):
            try:
                column = _coerce_object(raw_column)
            except TypeError as exc:
                raise ValueError(f"table.columns[{index}] must be an object") from exc

            name = column.get("name")
            if not isinstance(name, str) or not name.strip():
                raise ValueError(
                    f"table.columns[{index}].name must be a non-empty string"
                )
            _validate_column_name(
                name,
                require_canonical=not legacy_names_may_be_noncanonical,
            )
            if name in seen_names:
                raise ValueError(
                    f"table.columns contains duplicate column name '{name}'"
                )
            seen_names.add(name)

            column.pop("name", None)
            _prune_none(column)
            _validate_named_column_payload(name, column, f"table.columns[{index}]")
            normalized[name] = column
        return normalized

    if isinstance(columns, dict):
        if len(columns) == 0:
            raise ValueError("table.columns must be a non-empty array or object")

        normalized = {}
        for name, raw_column in columns.items():
            _validate_column_name(name, require_canonical=True)
            try:
                column = _coerce_object(raw_column)
            except TypeError as exc:
                raise ValueError(f"table.columns.{name} must be an object") from exc
            _prune_none(column)
            if "name" in column:
                raise ValueError(
                    f"table.columns.{name} must not contain a name property"
                )
            _validate_named_column_payload(name, column, f"table.columns.{name}")
            normalized[name] = column
        return normalized

    raise ValueError("table.columns must be a non-empty array or object")


def _normalize_payload_fields(payload: Dict[str, Any], extra: Dict[str, Any]) -> None:
    mapping = {
        "data_group": "dataGroup",
        "interval_start": "intervalStart",
        "interval_end": "intervalEnd",
        "window_start": "windowStart",
        "window_end": "windowEnd",
        "event_id": "eventId",
        "deleted_at": "deletedAt",
        "last_seen": "lastSeen",
        "foreign_event_key": "foreignEventKey",
    }
    for key, value in extra.items():
        target = mapping.get(key, key)
        payload[target] = value


def _prune_none(payload: Dict[str, Any]) -> None:
    for key in list(payload.keys()):
        if payload[key] is None:
            payload.pop(key, None)


class UnsPacket:
    version: str = "2.0.0"

    @staticmethod
    def data(
        value: DataValue,
        uom: Optional[str] = None,
        time: Optional[datetime | str] = None,
        data_group: Optional[str] = None,
        created_at: Optional[datetime | str] = None,
        expires_at: Optional[datetime | str] = None,
        **extra: Any,
    ) -> Dict[str, Any]:
        resolved_time = (
            time
            if isinstance(time, str)
            else isoformat(time or datetime.now(timezone.utc))
        )
        payload = {
            "value": value,
            "uom": uom,
            "time": resolved_time,
            "dataGroup": data_group,
        }
        _normalize_payload_fields(payload, extra)
        _prune_none(payload)
        _validate_data_payload(payload)
        payload["valueType"] = _value_type(cast(DataValue, payload["value"]))
        message: Dict[str, Any] = {"data": payload}
        if created_at is not None:
            message["createdAt"] = (
                created_at if isinstance(created_at, str) else isoformat(created_at)
            )
        if expires_at is not None:
            message["expiresAt"] = (
                expires_at if isinstance(expires_at, str) else isoformat(expires_at)
            )
        return {"version": UnsPacket.version, "message": message}

    @staticmethod
    def table(
        table: Optional[Dict[str, Any]] = None,
        *,
        columns: Optional[
            list[TableColumnPayload | Dict[str, Any]]
            | Dict[str, TableColumnPayload | Dict[str, Any]]
        ] = None,
        time: Optional[datetime | str] = None,
        data_group: Optional[str] = None,
        created_at: Optional[datetime | str] = None,
        expires_at: Optional[datetime | str] = None,
        **extra: Any,
    ) -> Dict[str, Any]:
        if table is None:
            if columns is None:
                raise ValueError("table() requires either table dict or columns")
            resolved_time = (
                time
                if isinstance(time, str)
                else isoformat(time or datetime.now(timezone.utc))
            )
            payload: Dict[str, Any] = {
                "time": resolved_time,
                "columns": columns,
                "dataGroup": data_group,
            }
        else:
            payload = dict(table)
            if "time" not in payload:
                payload["time"] = (
                    time
                    if isinstance(time, str)
                    else isoformat(time or datetime.now(timezone.utc))
                )
            if data_group is not None and "dataGroup" not in payload:
                payload["dataGroup"] = data_group

        _normalize_payload_fields(payload, extra)
        _prune_none(payload)
        if "columns" in payload:
            payload["columns"] = _normalize_table_columns(payload["columns"])
        _validate_table_payload(payload)
        message: Dict[str, Any] = {"table": payload}
        if created_at is not None:
            message["createdAt"] = (
                created_at if isinstance(created_at, str) else isoformat(created_at)
            )
        if expires_at is not None:
            message["expiresAt"] = (
                expires_at if isinstance(expires_at, str) else isoformat(expires_at)
            )
        return {"version": UnsPacket.version, "message": message}

    @staticmethod
    def to_json(packet: Dict[str, Any]) -> str:
        return json.dumps(packet, separators=(",", ":"))

    @staticmethod
    def parse(packet_str: str) -> Optional[Dict[str, Any]]:
        try:
            packet = json.loads(packet_str)
            if not isinstance(packet, dict):
                raise ValueError("packet must be an object")
            version = packet.get("version")
            if not isinstance(version, str) or not (
                version == UnsPacket.version
                or SUPPORTED_LEGACY_PACKET_VERSION_RE.fullmatch(version)
            ):
                raise ValueError(f"unsupported or missing packet version '{version}'")
            message = packet.get("message")
            if not isinstance(message, dict):
                raise ValueError("packet.message must be an object")

            normalized_message = dict(message)
            data = normalized_message.get("data")
            if isinstance(data, dict):
                data = dict(data)
                _validate_data_payload(data)
                data["valueType"] = _value_type(data["value"])
                normalized_message["data"] = data
            elif data is not None:
                raise ValueError("message.data must be an object when provided")

            table = normalized_message.get("table")
            if isinstance(table, dict):
                table = dict(table)
                legacy_column_array = isinstance(table.get("columns"), list)
                if "columns" in table:
                    table["columns"] = _normalize_table_columns(
                        table["columns"],
                        legacy_names_may_be_noncanonical=True,
                    )
                _validate_table_payload(
                    table,
                    require_canonical_names=not legacy_column_array,
                )
                normalized_message["table"] = table
            elif table is not None:
                raise ValueError("message.table must be an object when provided")

            return {**packet, "message": normalized_message}
        except Exception as exc:
            log.error("Could not parse UNS packet: %s", exc)
            return None

    @staticmethod
    def from_message(message: Dict[str, Any]) -> Dict[str, Any]:
        msg = dict(message)
        data = msg.get("data")
        if isinstance(data, dict):
            data = dict(data)
            _validate_data_payload(data)
            data["valueType"] = _value_type(data["value"])
            msg["data"] = data
        elif data is not None:
            raise ValueError("message.data must be an object when provided")

        table = msg.get("table")
        if isinstance(table, dict):
            table = dict(table)
            if "columns" in table:
                table["columns"] = _normalize_table_columns(table["columns"])
            _validate_table_payload(table)
            msg["table"] = table
        elif table is not None:
            raise ValueError("message.table must be an object when provided")
        return {"version": UnsPacket.version, "message": msg}
