from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Any, Dict, Optional
import json


def isoformat(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


@dataclass
class DataPayload:
    value: Any
    uom: Optional[str] = None
    time: Optional[str] = None
    dataGroup: Optional[str] = None
    createdAt: Optional[str] = None
    expiresAt: Optional[str] = None


@dataclass
class TablePayload:
    table: Any
    dataGroup: Optional[str] = None
    createdAt: Optional[str] = None
    expiresAt: Optional[str] = None


class UnsPacket:
    version: int = 1

    @staticmethod
    def data(
        value: Any,
        uom: Optional[str] = None,
        time: Optional[datetime] = None,
        data_group: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload = DataPayload(
          value=value,
          uom=uom,
          time=isoformat(time or datetime.utcnow()),
          dataGroup=data_group,
        )
        return {"version": UnsPacket.version, "message": {"data": asdict(payload)}}

    @staticmethod
    def table(table: Any, data_group: Optional[str] = None) -> Dict[str, Any]:
        payload = TablePayload(table=table, dataGroup=data_group)
        return {"version": UnsPacket.version, "message": {"table": asdict(payload)}}

    @staticmethod
    def to_json(packet: Dict[str, Any]) -> str:
        return json.dumps(packet, separators=(",", ":"))

    @staticmethod
    def parse(packet_str: str) -> Optional[Dict[str, Any]]:
        try:
            return json.loads(packet_str)
        except Exception:
            return None
