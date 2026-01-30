import asyncio
import math
from datetime import datetime
from pathlib import Path

from uns_kit import UnsConfig, UnsMqttClient


def load_config() -> UnsConfig:
    cfg_path = Path("config.json")
    if cfg_path.exists():
        return UnsConfig.load(cfg_path)
    return UnsConfig(host="localhost")


def simulate_sensor_value(step: int) -> float:
    base_value = 42.0
    fast_cycle = math.sin(step / 5.0) * 3.0
    slow_cycle = math.sin(step / 25.0) * 6.0
    ripple = math.sin(step / 2.0 + math.pi / 4.0) * 0.5
    value = base_value + fast_cycle + slow_cycle + ripple
    return round(value, 2)


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


def prompt_topic(prompt: str, default: str) -> str:
    answer = input(f"{prompt} (default {default}) ").strip()
    return answer or default


def log_info(message: str) -> None:
    timestamp = datetime.now().isoformat(timespec="seconds")
    print(f"{timestamp} [INFO] {message}")


async def main() -> None:
    cfg = load_config()
    host = f"{cfg.host}:{cfg.port}" if cfg.port else cfg.host

    if not prompt_bool(f"Would you like to continue with load-test on {host}?"):
        print("Load test aborted.")
        return

    count = prompt_int("How many iterations should be run?", 100, "")
    delay_ms = prompt_int("What should be the delay between intervals in milliseconds?", 0, " ms")
    topic = prompt_topic("Topic to publish to", "raw/data")
    delay_s = delay_ms / 1000.0

    log_info(f"Starting load test with {count} messages and {delay_ms} ms delay...")

    tb = cfg.topic_builder()
    client = UnsMqttClient(
        cfg.host,
        port=cfg.port,
        username=cfg.username or None,
        password=cfg.password or None,
        tls=cfg.tls,
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
