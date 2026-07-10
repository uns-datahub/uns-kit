from __future__ import annotations

import time
from datetime import datetime, timezone

from uns_kit.core.config_file import ConfigFile
from uns_kit.core.logger import configure_logger, get_logger
from uns_kit.core.packet import UnsPacket
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
    try:
        return ConfigFile.load_config("config.json")
    except FileNotFoundError:
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
    proxy = process.create_mqtt_proxy_sync("py-sync-table-output")
    log.info("[publish-table-sync] Process and MQTT proxy connected.")

    try:
        for index in range(5):
            now = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
            packet = UnsPacket.table(
                time=now,
                data_group="metering",
                columns={
                    "active_energy_total": {
                        "value": round(12345.6 + index * 1.5, 2),
                        "uom": "kWh",
                    },
                    "power": {
                        "value": round(42.1 + index * 0.25, 2),
                        "uom": "kW",
                    },
                },
            )
            proxy.publish_packet("raw/table/", packet)
            log.info("[publish-table-sync] Published sample packet %s at %s", index, now)
            time.sleep(1)
    finally:
        process.stop()


if __name__ == "__main__":
    main()
