from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import re
from typing import Any, Dict, Literal, Optional, TypeAlias
import json

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
    name: str
    type: str
    value: TableValue
    uom: Optional[str] = None


@dataclass
class TablePayload:
    time: str
    columns: list[TableColumnPayload | Dict[str, Any]]
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


def _validate_table_payload(payload: Dict[str, Any]) -> None:
    columns = payload.get("columns")
    if not isinstance(columns, list) or len(columns) == 0:
        raise ValueError("table.columns must be a non-empty list")

    for index, column in enumerate(columns):
        if not isinstance(column, dict):
            raise ValueError(f"table.columns[{index}] must be an object")

        name = column.get("name")
        if not isinstance(name, str) or not name.strip():
            raise ValueError(f"table.columns[{index}].name must be a non-empty string")

        column_type = column.get("type")
        if not is_questdb_type(column_type):
            raise ValueError(
                f"table.columns[{index}].type must be a valid QuestDB type literal"
            )

        if "value" not in column:
            raise ValueError(f"table.columns[{index}].value is required")
        if not _is_table_value(column["value"]):
            raise ValueError(
                f"table.columns[{index}].value must be string, number, boolean, or null"
            )


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
    version: str = "1.3.0"

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
            time if isinstance(time, str) else isoformat(time or datetime.now(timezone.utc))
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
        payload["valueType"] = _value_type(payload["value"])
        message: Dict[str, Any] = {"data": payload}
        if created_at is not None:
            message["createdAt"] = created_at if isinstance(created_at, str) else isoformat(created_at)
        if expires_at is not None:
            message["expiresAt"] = expires_at if isinstance(expires_at, str) else isoformat(expires_at)
        return {"version": UnsPacket.version, "message": message}

    @staticmethod
    def table(
        table: Optional[Dict[str, Any]] = None,
        *,
        columns: Optional[list[TableColumnPayload | Dict[str, Any]]] = None,
        time: Optional[datetime | str] = None,
        data_group: Optional[str] = None,
        created_at: Optional[datetime | str] = None,
        expires_at: Optional[datetime | str] = None,
        **extra: Any,
    ) -> Dict[str, Any]:
        if table is None:
            if columns is None:
                raise ValueError("table() requires either table dict or columns list")
            resolved_time = (
                time if isinstance(time, str) else isoformat(time or datetime.now(timezone.utc))
            )
            payload = {
                "time": resolved_time,
                "columns": columns,
                "dataGroup": data_group,
            }
        else:
            payload = dict(table)
            if "time" not in payload:
                payload["time"] = (
                    time if isinstance(time, str) else isoformat(time or datetime.now(timezone.utc))
                )
            if data_group is not None and "dataGroup" not in payload:
                payload["dataGroup"] = data_group

        _normalize_payload_fields(payload, extra)
        _prune_none(payload)
        _validate_table_payload(payload)
        message: Dict[str, Any] = {"table": payload}
        if created_at is not None:
            message["createdAt"] = created_at if isinstance(created_at, str) else isoformat(created_at)
        if expires_at is not None:
            message["expiresAt"] = expires_at if isinstance(expires_at, str) else isoformat(expires_at)
        return {"version": UnsPacket.version, "message": message}

    @staticmethod
    def to_json(packet: Dict[str, Any]) -> str:
        return json.dumps(packet, separators=(",", ":"))

    @staticmethod
    def parse(packet_str: str) -> Optional[Dict[str, Any]]:
        try:
            return json.loads(packet_str)
        except Exception:
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
            _validate_table_payload(table)
            msg["table"] = table
        elif table is not None:
            raise ValueError("message.table must be an object when provided")
        return {"version": UnsPacket.version, "message": msg}
