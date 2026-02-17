import asyncio
from pathlib import Path

from uns_kit import ConfigFile, TopicBuilder, UnsMqttClient, UnsPacket


async def run():
    cfg = ConfigFile.load_config(Path("config.json"))
    infra = cfg.get("infra") or {}
    uns = cfg.get("uns") or {}
    host = infra.get("host") or "localhost"
    process_name = uns.get("processName") or "uns-process"
    tb = TopicBuilder(
        uns.get("packageName") or "uns-kit",
        uns.get("packageVersion") or "0.1.0",
        process_name,
    )

    client = UnsMqttClient(
        host,
        port=infra.get("port"),
        username=infra.get("username"),
        password=infra.get("password"),
        tls=bool(infra.get("tls")),
        client_id=infra.get("clientId") or f"{process_name}-py",
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
