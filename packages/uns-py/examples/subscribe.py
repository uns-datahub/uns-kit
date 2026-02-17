import asyncio
from uns_kit import TopicBuilder, UnsMqttClient


async def main() -> None:
    tb = TopicBuilder("py-demo")
    client = UnsMqttClient("localhost", topic_builder=tb, instance_name="py-demo", reconnect_interval=1)
    await client.connect()

    async for msg in client.resilient_messages("uns-infra/#"):
        print("received", msg.topic, msg.payload.decode())


if __name__ == "__main__":
    asyncio.run(main())
