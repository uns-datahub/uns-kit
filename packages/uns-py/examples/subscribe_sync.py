from __future__ import annotations

import threading
from pathlib import Path

from uns_kit.core.config_file import ConfigFile
from uns_kit.core.proxy_process import UnsProcessParameters
from uns_kit.core.proxy_process_sync import UnsProxyProcessSync
from uns_kit.core.logger import configure_logger, get_logger

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
    proxy = process.create_mqtt_proxy_sync("py-sync-input")
    log.info("[subscribe-sync] Listening on uns-infra/#")
    stop_event = threading.Event()
    subscription = None

    def on_message(message) -> None:
        payload = message.payload.decode() if isinstance(message.payload, bytes) else str(message.payload)
        log.info("received topic=%s payload=%s", message.topic, payload)

    try:
        subscription = proxy.subscribe("uns-infra/#", on_message=on_message)
        stop_event.wait()
    except KeyboardInterrupt:
        log.info("[subscribe-sync] Stopped by user.")
    finally:
        if subscription is not None:
            subscription.close()
        proxy.close()
        process.stop()


if __name__ == "__main__":
    main()
