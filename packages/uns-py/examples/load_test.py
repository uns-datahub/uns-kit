import asyncio
import math
from datetime import datetime, timezone
from pathlib import Path

from uns_kit.core.config_file import ConfigFile
from uns_kit.core.logger import configure_logger, get_logger
from uns_kit.core.proxy_process import UnsProcessParameters, UnsProxyProcess

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


def prompt_bool(prompt: str, default_yes: bool = True) -> bool:
    suffix = " (Y/n) " if default_yes else " (y/N) "
    answer = input(prompt + suffix).strip().lower()
    if not answer:
        return default_yes
    return answer in ("y", "yes")


def prompt_int(prompt: str, default: int, suffix: str = "") -> int:
    answer = input(f"{prompt} (default {default}{suffix}) ").strip()
    try:
        return int(answer) if answer else default
    except ValueError:
        return default


def log_info(message: str) -> None:
    timestamp = datetime.now().isoformat(timespec="seconds")
    log.info("%s [INFO] %s", timestamp, message)


def simulate_sensor_value(step: int) -> float:
    base_value = 42.0
    fast_cycle = math.sin(step / 5.0) * 3.0
    slow_cycle = math.sin(step / 25.0) * 6.0
    ripple = math.sin(step / 2.0 + math.pi / 4.0) * 0.5
    return round(base_value + fast_cycle + slow_cycle + ripple, 2)


async def main() -> None:
    cfg = load_config()
    infra = cfg.get("infra") or {}
    uns = cfg.get("uns") or {}
    host_name = infra.get("host") or "localhost"
    host_port = infra.get("port")
    process_name = uns.get("processName") or "uns-process"

    host_display = f"{host_name}:{host_port}" if host_port else host_name
    if not prompt_bool(f"Would you like to continue with load-test on {host_display}?"):
        log.info("Load test aborted.")
        return

    count = prompt_int("How many iterations should be run?", 1000)
    delay_ms = prompt_int("What should be the delay between intervals in milliseconds?", 0, " ms")
    publish_concurrency = prompt_int("Publish concurrency", 32)
    max_pending_publishes = prompt_int("Max pending publishes (0 = unbounded)", 0)
    topic = input("Topic to publish to (default raw/data/) ").strip() or "raw/data/"
    asset = input("Asset name (default demo-line) ").strip() or "demo-line"
    object_type = input("Object type (default equipment) ").strip() or "equipment"
    object_id = input("Object id (default main) ").strip() or "main"
    attribute = input("Attribute name (default load-test) ").strip() or "load-test"
    delay_s = delay_ms / 1000.0

    process = UnsProxyProcess(
        host_name,
        UnsProcessParameters(
            process_name=process_name,
            username=infra.get("username"),
            password=infra.get("password"),
            mqtt_ssl=bool(infra.get("tls") or infra.get("mqttSSL")),
            port=host_port,
        ),
    )
    await process.start()
    mqtt_output = await process.create_uns_mqtt_proxy(
        host_name,
        "py-load-test-output",
        "wait",
        True,
        {
            "port": host_port,
            "publishConcurrency": publish_concurrency,
            "maxPendingPublishes": max_pending_publishes,
        },
    )

    log_info(
        f"Starting SDK load test with {count} messages, {delay_ms} ms delay, "
        f"publishConcurrency={publish_concurrency}, "
        f"maxPendingPublishes={'unbounded' if max_pending_publishes <= 0 else max_pending_publishes}, "
        f"topic={topic}{asset}/{object_type}/{object_id}/{attribute}"
    )

    start = asyncio.get_event_loop().time()
    try:
        for i in range(count):
            now = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
            sensor_value = simulate_sensor_value(i)
            await mqtt_output.publish_mqtt_message(
                {
                    "topic": topic,
                    "asset": asset,
                    "objectType": object_type,
                    "objectId": object_id,
                    "attributes": {
                        "attribute": attribute,
                        "description": "Python SDK load-test value",
                        "data": {
                            "time": now,
                            "value": sensor_value,
                        },
                    },
                }
            )
            if delay_s:
                await asyncio.sleep(delay_s)
    finally:
        await mqtt_output.flush()
        end = asyncio.get_event_loop().time()
        duration = end - start
        rate = count / duration if duration > 0 else 0
        log_info(f"Load test completed in {duration:.2f} seconds.")
        log_info(f"Message rate: {rate:.2f} msg/s.")
        await mqtt_output.close()
        await process.stop()


if __name__ == "__main__":
    asyncio.run(main())
