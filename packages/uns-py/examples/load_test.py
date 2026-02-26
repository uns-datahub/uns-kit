import asyncio
import math
from datetime import datetime
from pathlib import Path

from uns_kit import ConfigFile, TopicBuilder, UnsMqttClient
from uns_kit.logger import configure_logger, get_logger

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


def prompt_float(prompt: str, default: float) -> float:
    answer = input(f"{prompt} (default {default}) ").strip()
    try:
        return float(answer) if answer else default
    except ValueError:
        return default


def log_info(message: str) -> None:
    timestamp = datetime.now().isoformat(timespec="seconds")
    log.info(f"{timestamp} [INFO] {message}")


def simulate_sensor_value(step: int) -> float:
    base_value = 42.0
    fast_cycle = math.sin(step / 5.0) * 3.0
    slow_cycle = math.sin(step / 25.0) * 6.0
    ripple = math.sin(step / 2.0 + math.pi / 4.0) * 0.5
    value = base_value + fast_cycle + slow_cycle + ripple
    return round(value, 2)


async def main() -> None:
    cfg = load_config()
    infra = cfg.get("infra") or {}
    uns = cfg.get("uns") or {}
    host_name = infra.get("host") or "localhost"
    host_port = infra.get("port")
    host = f"{host_name}:{host_port}" if host_port else host_name

    if not prompt_bool(f"Would you like to continue with load-test on {host}?"):
        log.info("Load test aborted.")
        return

    count = prompt_int("How many iterations should be run?", 100, "")
    delay_ms = prompt_int("What should be the delay between intervals in milliseconds?", 0, " ms")
    topic = input("Topic to publish to (default raw/data) ").strip() or "raw/data"
    delay_s = delay_ms / 1000.0

    log_info(f"Starting load test with {count} messages and {delay_ms} ms delay...")

    tb = TopicBuilder(
        uns.get("processName") or "uns-process",
    )
    client = UnsMqttClient(
        host_name,
        port=host_port,
        username=infra.get("username") or None,
        password=infra.get("password") or None,
        tls=bool(infra.get("tls")),
        client_id=None,
        topic_builder=tb,
        instance_name="py-load-test",
        reconnect_interval=1,
    )
    await client.connect()

    start = asyncio.get_event_loop().time()
    for i in range(count):
        now = asyncio.get_event_loop().time()
        sensor_value = simulate_sensor_value(i)
        raw_payload = f"{i},{int(now * 1000)},{sensor_value}"
        await client.publish_raw(topic, raw_payload)
        if delay_s:
            await asyncio.sleep(delay_s)

    log_info("Sleeping for 50ms.")
    await asyncio.sleep(0.05)
    end = asyncio.get_event_loop().time()
    duration = end - start
    rate = count / duration if duration > 0 else 0
    log_info(f"Load test completed in {duration:.2f} seconds.")
    log_info(f"Message rate: {rate:.2f} msg/s.")

    await client.close()


if __name__ == "__main__":
    asyncio.run(main())
