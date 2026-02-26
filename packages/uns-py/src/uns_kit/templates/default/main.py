import asyncio
from pathlib import Path

from uns_kit import ConfigFile, TopicBuilder, UnsMqttClient, UnsPacket
from uns_kit.logger import configure_logger, get_logger

configure_logger(
    settings={
        "level": "INFO",
        "console": True,
    }
)
log = get_logger(__name__)

async def run():
    cfg = ConfigFile.load_config(Path("config.json"))
    infra = cfg.get("infra") or {}
    uns = cfg.get("uns") or {}
    host = infra.get("host") or "localhost"
    process_name = uns.get("processName") or "uns-process"
    tb = TopicBuilder(process_name=process_name)

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
    log.info("Client connected.")

    # Publish a startup heartbeat to raw/data/ (can be changed)
    await client.publish_packet("raw/data/", UnsPacket.data(value="started", uom="state"))

    # Idle loop; adjust to your workload
    while True:
        await asyncio.sleep(5)


if __name__ == "__main__":
    asyncio.run(run())
