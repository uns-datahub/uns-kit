import asyncio
from datetime import datetime, timezone

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


async def main() -> None:
    tb = TopicBuilder("py-demo")
    client = UnsMqttClient("localhost", topic_builder=tb, instance_name="py-demo-table", reconnect_interval=1)
    await client.connect()
    log.info("connected host=%s", "localhost")

    for i in range(5):
        now = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
        packet = UnsPacket.table(
            time=now,
            data_group="metering",
            columns={
                "active_energy_total": {
                    "value": round(12345.6 + i * 1.5, 2),
                    "uom": "kWh",
                },
                "power": {
                    "value": round(42.1 + i * 0.25, 2),
                    "uom": "kW",
                },
            },
        )
        await client.publish_packet("raw/table/", packet)
        log.info("published topic=%s time=%s", "raw/table/", now)
        await asyncio.sleep(0.1)

    await client.close()


if __name__ == "__main__":
    asyncio.run(main())
