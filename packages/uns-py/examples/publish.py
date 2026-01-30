import asyncio
from uns_kit import TopicBuilder, UnsMqttClient, UnsPacket


async def main() -> None:
    tb = TopicBuilder("uns-kit", "0.0.1", "py-demo")
    client = UnsMqttClient("localhost", topic_builder=tb, instance_name="py-demo", reconnect_interval=1)
    await client.connect()

    for i in range(5):
        packet = UnsPacket.data(value=i, uom="count")
        await client.publish_packet("raw/data/", packet)
        await asyncio.sleep(0.1)

    await client.close()


if __name__ == "__main__":
    asyncio.run(main())
