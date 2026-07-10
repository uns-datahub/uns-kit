import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path

from uns_kit.core.config_file import ConfigFile
from uns_kit.core.logger import configure_logger
from uns_kit.core.proxy_process import UnsProxyProcess


configure_logger(settings={"level": "INFO", "console": True})
logger = logging.getLogger("uns_kit").getChild(__name__)


def load_config() -> dict:
    cfg_path = Path("config.json")
    if cfg_path.exists():
        return ConfigFile.load_config(cfg_path)
    return {"infra": {"host": "localhost"}, "uns": {"processName": "uns-process"}}


async def run() -> None:
    config = load_config()
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
        try:
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
        except Exception as exc:
            logger.error("Error publishing message to MQTT: %s", exc)
            raise

    cron.event.on("cronEvent", handle_cron)

    try:
        await asyncio.Event().wait()
    finally:
        await mqtt_output.flush()
        await mqtt_output.close()
        await process.stop()


if __name__ == "__main__":
    asyncio.run(run())
