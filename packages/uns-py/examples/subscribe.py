import asyncio
from pathlib import Path

from uns_kit.core.client import UnsMqttClient
from uns_kit.core.config_file import ConfigFile
from uns_kit.core.logger import configure_logger, get_logger
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

    async for msg in client.resilient_messages("uns-infra/#"):
        log.info("received topic=%s payload=%s", msg.topic, msg.payload.decode())


if __name__ == "__main__":
    asyncio.run(main())
