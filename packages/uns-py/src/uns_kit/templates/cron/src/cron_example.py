import asyncio
from datetime import datetime, timezone
from pathlib import Path

from uns_kit import ConfigFile, UnsProxyProcess


async def run() -> None:
    config = ConfigFile.load_config(Path("config.json"))
    infra = config.get("infra") or {}
    uns = config.get("uns") or {}

    process = UnsProxyProcess(
        infra.get("host") or "localhost",
        {"processName": uns.get("processName") or "uns-cron"},
    )
    await process.start()
    mqtt_output = await process.create_mqtt_proxy("templateUnsRttOutput")
    cron = await process.create_cron_proxy("* * * * * *")

    async def handle_cron(_event):
        await mqtt_output.publish_mqtt_message(
            {
                "topic": "example/site/area/line/",
                "asset": "demo-asset",
                "objectType": "energy-resource",
                "objectId": "main-bus",
                "attributes": [
                    {
                        "attribute": "current",
                        "description": "Cron sample current",
                        "data": {
                            "time": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                            "value": 42,
                            "uom": "Ampere",
                            "dataGroup": "sensor",
                        },
                    }
                ],
            }
        )

    cron.event.on("cronEvent", handle_cron)

    try:
        await asyncio.Event().wait()
    finally:
        await mqtt_output.close()
        await process.stop()


if __name__ == "__main__":
    asyncio.run(run())
