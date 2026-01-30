from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional

from .client import UnsMqttClient
from .packet import UnsPacket, isoformat
from .proxy import UnsProxy
from .topic_builder import TopicBuilder


class MessageMode(str, Enum):
    RAW = "raw"
    DELTA = "delta"
    BOTH = "both"


@dataclass
class LastValueEntry:
    value: Any
    uom: Optional[str]
    timestamp: datetime


class UnsMqttProxy(UnsProxy):
    def __init__(
        self,
        host: str,
        *,
        process_name: str,
        instance_name: str,
        package_name: str = "uns-kit",
        package_version: str = "0.0.1",
        port: Optional[int] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        tls: bool = False,
        client_id: Optional[str] = None,
        keepalive: int = 60,
        clean_session: bool = True,
    ) -> None:
        self.topic_builder = TopicBuilder(package_name, package_version, process_name)
        self.instance_status_topic = self.topic_builder.instance_status_topic(instance_name)
        self.client = UnsMqttClient(
            host,
            port=port,
            username=username,
            password=password,
            tls=tls,
            client_id=client_id,
            keepalive=keepalive,
            clean_session=clean_session,
            topic_builder=self.topic_builder,
            instance_name=instance_name,
            publisher_active=True,
            subscriber_active=True,
        )
        super().__init__(self.client, self.instance_status_topic, instance_name)
        self._last_values: Dict[str, LastValueEntry] = {}
        self._sequence_ids: Dict[str, int] = {}

    async def connect(self) -> None:
        await self.client.connect()
        await self.start()

    async def close(self) -> None:
        await self.stop()
        await self.client.close()

    async def publish_message(self, topic: str, payload: str | bytes) -> None:
        await self.client.publish_raw(topic, payload)

    async def publish_packet(self, topic: str, packet: Dict[str, Any]) -> None:
        await self.client.publish_packet(topic, packet)

    async def publish_mqtt_message(self, mqtt_message: Dict[str, Any], mode: MessageMode = MessageMode.RAW) -> None:
        attrs = mqtt_message.get("attributes")
        if attrs is None:
            raise ValueError("mqtt_message must include attributes")
        if not isinstance(attrs, list):
            attrs = [attrs]

        base_topic = mqtt_message.get("topic", "")
        asset = mqtt_message.get("asset")
        asset_description = mqtt_message.get("assetDescription")
        object_type = mqtt_message.get("objectType")
        object_type_description = mqtt_message.get("objectTypeDescription")
        object_id = mqtt_message.get("objectId")

        for attr in attrs:
            attribute = attr.get("attribute")
            if attribute is None:
                raise ValueError("attribute is required")
            description = attr.get("description")
            tags = attr.get("tags")
            attribute_needs_persistence = attr.get("attributeNeedsPersistence")

            message = attr.get("message")
            if message is None:
                if "data" in attr:
                    message = {
                        "data": attr["data"],
                        **({"createdAt": attr["createdAt"]} if attr.get("createdAt") else {}),
                        **({"expiresAt": attr["expiresAt"]} if attr.get("expiresAt") else {}),
                    }
                elif "table" in attr:
                    message = {
                        "table": attr["table"],
                        **({"createdAt": attr["createdAt"]} if attr.get("createdAt") else {}),
                        **({"expiresAt": attr["expiresAt"]} if attr.get("expiresAt") else {}),
                    }
                else:
                    raise ValueError("Attribute entry must include exactly one of data/table/message")

            packet = UnsPacket.from_message(message)

            msg = {
                "topic": base_topic,
                "asset": asset,
                "assetDescription": asset_description,
                "objectType": object_type,
                "objectTypeDescription": object_type_description,
                "objectId": object_id,
                "attribute": attribute,
                "description": description or attribute,
                "tags": tags,
                "attributeNeedsPersistence": attribute_needs_persistence,
                "packet": packet,
            }

            if mode == MessageMode.RAW:
                await self._process_and_publish(msg, value_is_cumulative=False)
            elif mode == MessageMode.DELTA:
                delta_msg = dict(msg)
                delta_msg["attribute"] = f"{attribute}-delta"
                delta_msg["description"] = f"{msg['description']} (delta)"
                await self._process_and_publish(delta_msg, value_is_cumulative=True)
            elif mode == MessageMode.BOTH:
                await self._process_and_publish(msg, value_is_cumulative=False)
                delta_msg = dict(msg)
                delta_msg["attribute"] = f"{attribute}-delta"
                delta_msg["description"] = f"{msg['description']} (delta)"
                await self._process_and_publish(delta_msg, value_is_cumulative=True)

    def _resolve_object_identity(self, msg: Dict[str, Any]) -> None:
        topic = msg.get("topic", "")
        provided_type = msg.get("objectType")
        provided_id = msg.get("objectId")
        provided_asset = msg.get("asset")

        parts = [p for p in topic.split("/") if p]
        parsed_type = parts[-2] if len(parts) >= 2 else None
        parsed_id = parts[-1] if len(parts) >= 1 else None
        parsed_asset = parts[-3] if len(parts) >= 3 else None

        msg["objectType"] = provided_type or parsed_type
        msg["objectId"] = provided_id or parsed_id or "main"
        msg["asset"] = provided_asset or parsed_asset

    def _normalize_topic(self, topic: str) -> str:
        return topic if topic.endswith("/") else f"{topic}/"

    async def _process_and_publish(self, msg: Dict[str, Any], *, value_is_cumulative: bool) -> None:
        self._resolve_object_identity(msg)
        base_topic = self._normalize_topic(msg.get("topic", ""))

        packet = msg["packet"]
        message = packet.get("message", {})
        data = message.get("data")
        table = message.get("table")

        attribute_type = "Data" if data is not None else "Table" if table is not None else None
        data_group = ""
        if isinstance(data, dict):
            data_group = data.get("dataGroup") or ""
        if isinstance(table, dict):
            data_group = table.get("dataGroup") or ""

        await self.register_unique_topic(
            {
                "timestamp": isoformat(datetime.utcnow()),
                "topic": base_topic,
                "asset": msg.get("asset"),
                "assetDescription": msg.get("assetDescription"),
                "objectType": msg.get("objectType"),
                "objectTypeDescription": msg.get("objectTypeDescription"),
                "objectId": msg.get("objectId"),
                "attribute": msg.get("attribute"),
                "attributeType": attribute_type,
                "description": msg.get("description"),
                "tags": msg.get("tags"),
                "attributeNeedsPersistence": msg.get("attributeNeedsPersistence"),
                "dataGroup": data_group,
            }
        )

        publish_topic = (
            f"{base_topic}"
            f"{msg.get('asset') + '/' if msg.get('asset') else ''}"
            f"{msg.get('objectType') + '/' if msg.get('objectType') else ''}"
            f"{msg.get('objectId') + '/' if msg.get('objectId') else ''}"
            f"{msg.get('attribute')}"
        )

        seq_id = self._sequence_ids.get(base_topic, 0)
        self._sequence_ids[base_topic] = seq_id + 1
        packet["sequenceId"] = seq_id

        if isinstance(data, dict):
            time_value = data.get("time")
            if not time_value:
                time_value = UnsPacket.data(value=0)["message"]["data"]["time"]
                data["time"] = time_value
            current_time = datetime.fromisoformat(time_value.replace("Z", "+00:00"))
            new_value = data.get("value")
            new_uom = data.get("uom")
            last = self._last_values.get(publish_topic)
            if last:
                interval_ms = int((current_time - last.timestamp).total_seconds() * 1000)
                packet["interval"] = interval_ms
                self._last_values[publish_topic] = LastValueEntry(new_value, new_uom, current_time)
                if value_is_cumulative and isinstance(new_value, (int, float)) and isinstance(last.value, (int, float)):
                    if new_value == 0:
                        return
                    delta = new_value - last.value
                    data["value"] = new_value if delta < 0 else delta
                await self.client.publish_raw(publish_topic, UnsPacket.to_json(packet))
            else:
                self._last_values[publish_topic] = LastValueEntry(new_value, new_uom, current_time)
                if not value_is_cumulative:
                    await self.client.publish_raw(publish_topic, UnsPacket.to_json(packet))
        elif isinstance(table, dict):
            await self.client.publish_raw(publish_topic, UnsPacket.to_json(packet))
        else:
            raise ValueError("packet.message must include data or table")
