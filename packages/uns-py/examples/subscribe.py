import asyncio
from uns_kit import UnsMqttClient, TopicBuilder
from uns_kit.logger import configure_logger, get_logger

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
