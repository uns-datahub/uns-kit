import asyncio
from pathlib import Path

from uns_kit import UnsConfig, UnsMqttClient, UnsProxyProcess


async def main():
    cfg = UnsConfig.load(Path("config.json"))
    tb = cfg.topic_builder()

    # Stage toggles
    PRINT_RAW = True
    PRINT_INFRA = True
    TRANSFORM_AND_PUBLISH = True

    sub = UnsMqttClient(
        cfg.host,
        port=cfg.port,
        username=cfg.username or None,
        password=cfg.password or None,
        tls=cfg.tls,
        client_id=f"{cfg.process_name}-printer",
        topic_builder=tb,
        instance_name="printer",
        subscriber_active=True,
        publisher_active=False,
    )
    await sub.connect()
    topics = []
    if PRINT_RAW:
        topics.append("raw/#")
    if PRINT_INFRA:
        topics.append("uns-infra/#")
    print(f"[printer] connected to {cfg.host}:{cfg.port or 1883}, subscribing to {topics}")

    out_proxy = None
    if TRANSFORM_AND_PUBLISH:
        process = UnsProxyProcess(cfg.host, cfg)
        await process.start()
        out_proxy = await process.create_mqtt_proxy("py-output")
        print("[printer] output proxy ready for transform/publish")

    async with sub.messages(topics) as msgs:
        async for msg in msgs:
            try:
                payload = msg.payload.decode(errors="replace")
            except Exception:
                payload = "<non-utf8 payload>"
            print(f"[printer] {msg.topic} -> {payload}")

            if TRANSFORM_AND_PUBLISH and str(msg.topic).startswith("raw/data"):
                parts = payload.split(",")
                if len(parts) < 3:
                    print("[printer] skip malformed raw/data")
                    continue
                try:
                    number_value = float(parts[0])
                    event_time_ms = int(parts[1])
                    sensor_value = float(parts[2])
                except ValueError:
                    print("[printer] parse error, skip")
                    continue

                from datetime import datetime, timezone, timedelta
                from uns_kit.packet import isoformat

                event_time = datetime.fromtimestamp(event_time_ms / 1000, tz=timezone.utc)
                interval_start = isoformat(event_time - timedelta(seconds=1))
                interval_end = isoformat(event_time)
                time = isoformat(event_time)

                await out_proxy.publish_mqtt_message(
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
                                    "time": time,
                                    "intervalStart": interval_start,
                                    "intervalEnd": interval_end,
                                    "value": number_value,
                                    "uom": "A",
                                },
                            },
                            {
                                "attribute": "voltage",
                                "description": "Simulated voltage sensor value",
                                "data": {
                                    "dataGroup": "sensor",
                                    "time": time,
                                    "intervalStart": interval_start,
                                    "intervalEnd": interval_end,
                                    "value": sensor_value,
                                    "uom": "V",
                                },
                            },
                        ],
                    }
                )
                print(f"[printer] transformed and published at {time}")

    await sub.close()
    if out_proxy:
        await out_proxy.close()


if __name__ == "__main__":
    asyncio.run(main())
