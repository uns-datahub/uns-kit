import asyncio

from uns_kit.core.client import UnsMqttClient
from uns_kit.core.logger import configure_logger, get_logger
from uns_kit.core.topic_builder import TopicBuilder

configure_logger(
    settings={
        "level": "INFO",
        "console": True,
    }
)
log = get_logger(__name__)


async def main() -> None:
    tb = TopicBuilder("py-demo")
    client = UnsMqttClient("localhost", topic_builder=tb, instance_name="py-demo", reconnect_interval=1)
    await client.connect()

    async for msg in client.resilient_messages("uns-infra/#"):
        log.info("received topic=%s payload=%s", msg.topic, msg.payload.decode())


if __name__ == "__main__":
    asyncio.run(main())
