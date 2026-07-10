from __future__ import annotations

import time
from datetime import datetime, timezone
from pathlib import Path

from uns_kit.core.config_file import ConfigFile
from uns_kit.core.logger import configure_logger, get_logger
from uns_kit.core.proxy_process import UnsProcessParameters
from uns_kit.core.proxy_process_sync import UnsProxyProcessSync

configure_logger(
    settings={
        "level": "INFO",
        "console": True,
    }
)
log = get_logger(__name__)


def load_config() -> dict:
    cfg_path = Path("config.json")
    if cfg_path.exists():
        return ConfigFile.load_config(cfg_path)
    return {"infra": {"host": "localhost"}, "uns": {"processName": "uns-process"}}


def main() -> None:
    cfg = load_config()
    infra = cfg.get("infra") or {}
    uns = cfg.get("uns") or {}

    process = UnsProxyProcessSync(
        infra.get("host") or "localhost",
        UnsProcessParameters(
            process_name=uns.get("processName") or "uns-process",
            username=infra.get("username"),
            password=infra.get("password"),
            mqtt_ssl=bool(infra.get("tls") or infra.get("mqttSSL")),
            port=infra.get("port"),
        ),
    )
    process.start()
    proxy = process.create_mqtt_proxy_sync("py-sync-output")
    log.info("[data-example-sync] Process and MQTT proxy connected.")

    try:
        for index in range(5):
            now = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
            proxy.publish_mqtt_message(
                {
                    "topic": "enterprise/site/area/line/",
                    "asset": "asset",
                    "assetDescription": "Sample asset",
                    "objectType": "energy-resource",
                    "objectId": "main",
                    "attributes": [
                        {
                            "attribute": "current",
                            "description": "Simulated current sensor value",
                            "data": {
                                "dataGroup": "sensor",
                                "time": now,
                                "value": round(10 + index * 0.5, 2),
                                "uom": "A",
                            },
                        },
                        {
                            "attribute": "active-energy-total",
                            "description": "Cumulative active energy counter",
                            "valueType": "number",
                            "presentationKind": "counter",
                            "defaultAggregation": "last",
                            "counterResetPolicy": "new-value",
                            "data": {
                                "dataGroup": "sensor",
                                "time": now,
                                "value": 1000 + index * 5,
                                "uom": "kWh",
                            },
                        },
                    ],
                }
            )
            log.info("[data-example-sync] Published sample packet %s at %s", index, now)
            time.sleep(1)
    finally:
        proxy.flush()
        process.stop()


if __name__ == "__main__":
    main()
