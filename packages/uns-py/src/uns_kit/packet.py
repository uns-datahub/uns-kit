from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Optional
import json


def isoformat(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


@dataclass
class DataPayload:
    value: Any
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
class TablePayload:
    time: str
    columns: Any
    dataGroup: Optional[str] = None
    intervalStart: Optional[str | int] = None
    intervalEnd: Optional[str | int] = None
    windowStart: Optional[str | int] = None
    windowEnd: Optional[str | int] = None
    eventId: Optional[str] = None
    deleted: Optional[bool] = None
    deletedAt: Optional[str | int] = None
    lastSeen: Optional[str | int] = None


def _value_type(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, (int, float)):
        return "number"
    if isinstance(value, str):
        return "string"
    return "object"


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
        value: Any,
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
            "valueType": _value_type(value),
        }
        _normalize_payload_fields(payload, extra)
        _prune_none(payload)
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
        columns: Optional[Any] = None,
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
            if "valueType" not in data and "value" in data:
                data = dict(data)
                data["valueType"] = _value_type(data.get("value"))
                msg["data"] = data
        return {"version": UnsPacket.version, "message": msg}
