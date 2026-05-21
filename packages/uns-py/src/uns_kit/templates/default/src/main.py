import asyncio
import logging
from datetime import datetime, timezone
from pathlib import Path

from uns_kit.core import ConfigFile, UnsProcessParameters, UnsProxyProcess, configure_logger

configure_logger(
    settings={
        "level": "INFO",
        "console": True,
    }
)
log = logging.getLogger("uns_kit").getChild(__name__)


async def run():
    cfg = ConfigFile.load_config(Path("config.json"))
    infra = cfg.get("infra") or {}
    uns = cfg.get("uns") or {}
    host = infra.get("host") or "localhost"
    process_name = uns.get("processName") or "uns-process"
    process = UnsProxyProcess(
        host,
        UnsProcessParameters(
            process_name=process_name,
            port=infra.get("port"),
            username=infra.get("username"),
            password=infra.get("password"),
            mqtt_ssl=bool(infra.get("tls")),
            client_id=infra.get("clientId"),
        ),
    )
    await process.start()
    output = await process.create_mqtt_proxy("py-output")
    log.info("Process and output proxy connected.")

    try:
        await output.publish_mqtt_message(
            {
                "topic": "example/site/area/line/",
                "asset": "demo-asset",
                "objectType": "utility-resource",
                "objectId": "main",
                "attributes": {
                    "attribute": "status",
                    "description": "Service startup marker",
                    "data": {
                        "time": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                        "value": "started",
                        "uom": "state",
                        "dataGroup": "runtime",
                    },
                    "validityMode": "lifecycle",
                    "lifecycleEndValue": "stopped",
                },
            }
        )
        log.info("Published startup marker via UNS output proxy.")

        while True:
            await asyncio.sleep(5)
    finally:
        await output.close()
        await process.stop()


if __name__ == "__main__":
    asyncio.run(run())
