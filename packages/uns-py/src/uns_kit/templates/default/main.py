import asyncio
import json
from pathlib import Path

from uns_kit import UnsMqttClient, UnsPacket, TopicBuilder, UnsConfig


async def run():
    # Load TS-style nested config
    cfg = UnsConfig.load(Path("config.json"))
    tb = cfg.topic_builder()

    client = UnsMqttClient(
        cfg.host,
        port=cfg.port,
        username=cfg.username,
        password=cfg.password,
        tls=cfg.tls,
        client_id=cfg.client_id or f"{cfg.process_name}-py",
        topic_builder=tb,
        reconnect_interval=1,
    )
    await client.connect()

    # Publish a startup heartbeat to raw/data/ (can be changed)
    await client.publish_packet("raw/data/", UnsPacket.data(value="started", uom="state"))

    # Idle loop; adjust to your workload
    while True:
        await asyncio.sleep(5)


if __name__ == "__main__":
    asyncio.run(run())
