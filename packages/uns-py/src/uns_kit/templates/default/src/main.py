import asyncio
from pathlib import Path

from uns_kit import UnsConfig, UnsPacket, UnsProxyProcess


async def main():
    cfg = UnsConfig.load(Path("config.json"))
    process = UnsProxyProcess(cfg.host, cfg)
    await process.start()

    mqtt = await process.create_mqtt_proxy("py")
    await mqtt.publish_packet("raw/data/", UnsPacket.data(value=1, uom="count"))

    async for msg in mqtt.client.resilient_messages("uns-infra/#"):
        print(msg.topic, msg.payload.decode())


if __name__ == "__main__":
    asyncio.run(main())
