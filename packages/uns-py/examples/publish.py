import asyncio
from uns_kit import UnsMqttClient, UnsPacket, TopicBuilder, get_logger


log = get_logger(__name__, "INFO")

async def main() -> None:
    tb = TopicBuilder("py-demo")
    client = UnsMqttClient("localhost", topic_builder=tb, instance_name="py-demo", reconnect_interval=1)
    await client.connect()
    log.info("connected host=%s", "localhost")

    for i in range(5):
        packet = UnsPacket.data(value=i, uom="count")
        await client.publish_packet("raw/data/", packet)
        log.info("published topic=%s value=%s", "raw/data/", i)
        await asyncio.sleep(0.1)

    await client.close()


if __name__ == "__main__":
    asyncio.run(main())
