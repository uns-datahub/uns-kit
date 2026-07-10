import asyncio
from pathlib import Path

from uns_kit.core.config_file import ConfigFile
from uns_kit.core.client import UnsMqttClient
from uns_kit.core.logger import configure_logger, get_logger
from uns_kit.core.packet import UnsPacket
from uns_kit.core.topic_builder import TopicBuilder

configure_logger(
    settings={
        "level": "INFO",
        "console": True,
    }
)
log = get_logger(__name__)


def load_config() -> dict:
    cfg_path = Path("config.json")
    if cfg_path.exists():
        return ConfigFile.load_config(cfg_path)
    return {"infra": {"host": "localhost"}, "uns": {"processName": "uns-process"}}


async def main() -> None:
    cfg = load_config()
    infra = cfg.get("infra") or {}
    host = infra.get("host") or "localhost"
    tb = TopicBuilder("py-demo")
    client = UnsMqttClient(host, topic_builder=tb, instance_name="py-demo", reconnect_interval=1)
    await client.connect()
    log.info("connected host=%s", host)

    for i in range(5):
        packet = UnsPacket.data(value=i, uom="count")
        await client.publish_packet("raw/data/", packet)
        log.info("published topic=%s value=%s", "raw/data/", i)
        await asyncio.sleep(0.1)

    await client.close()


if __name__ == "__main__":
    asyncio.run(main())
