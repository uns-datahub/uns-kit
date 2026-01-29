import asyncio
import json
from pathlib import Path
from uns_kit import UnsMqttClient, TopicBuilder, UnsPacket


async def main():
    cfg = json.loads(Path("config.json").read_text())
    tb = TopicBuilder(cfg["packageName"], cfg["packageVersion"], cfg["processName"])
    client = UnsMqttClient(
        cfg["host"],
        port=cfg.get("port"),
        username=cfg.get("username") or None,
        password=cfg.get("password") or None,
        tls=cfg.get("tls", False),
        client_id=cfg.get("clientId"),
        topic_builder=tb,
        reconnect_interval=1,
    )
    await client.connect()
    await client.publish_packet("raw/data/", UnsPacket.data(value=1, uom="count"))
    async for msg in client.resilient_messages("uns-infra/#"):
        print(msg.topic, msg.payload.decode())


if __name__ == "__main__":
    asyncio.run(main())
