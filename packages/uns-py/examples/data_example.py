import asyncio
from datetime import datetime, timedelta, timezone
from pathlib import Path

from uns_kit import UnsConfig, UnsMqttClient, UnsProxyProcess
from uns_kit.packet import isoformat


async def main() -> None:
    cfg_path = Path("config.json")
    cfg = UnsConfig.load(cfg_path) if cfg_path.exists() else UnsConfig(host="localhost")
    process = UnsProxyProcess(cfg.host, cfg)
    await process.start()
    print("[data-example] Process client connected.")

    mqtt_output = await process.create_mqtt_proxy("py-output")
    print("[data-example] Output proxy connected.")
    mqtt_input = UnsMqttClient(
        cfg.host,
        port=cfg.port,
        username=cfg.username or None,
        password=cfg.password or None,
        tls=cfg.tls,
        client_id=None,
        topic_builder=cfg.topic_builder(),
        instance_name="py-input",
        subscriber_active=True,
    )
    await mqtt_input.connect()
    print("[data-example] Input client connected, subscribing to raw/#")

    topic = "enterprise/site/area/line/"
    asset = "asset"
    asset_description = "Sample asset"
    object_type = "energy-resource"
    object_id = "main"

    try:
        async for msg in mqtt_input.resilient_messages("raw/#"):
            if msg.topic.value != "raw/data":
                continue
            payload = msg.payload.decode()
            values = payload.split(",")
            if len(values) < 3:
                print(f"Skipping malformed raw/data payload: {payload}")
                continue

            count_raw, timestamp_raw, sensor_raw = values[:3]
            try:
                number_value = float(count_raw)
                event_time = datetime.fromtimestamp(int(timestamp_raw) / 1000, tz=timezone.utc)
                sensor_value = float(sensor_raw)
            except ValueError:
                print(f"Skipping malformed raw/data payload: {payload}")
                continue

            interval_start = isoformat(event_time - timedelta(seconds=1))
            interval_end = isoformat(event_time)
            time = isoformat(event_time)

            await mqtt_output.publish_mqtt_message(
                {
                    "topic": topic,
                    "asset": asset,
                    "assetDescription": asset_description,
                    "objectType": object_type,
                    "objectId": object_id,
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
            print(f"[data-example] Published transformed attributes for ts={time}")
    except KeyboardInterrupt:
        pass
    finally:
        await mqtt_input.close()
        await mqtt_output.close()
        await process.stop()


if __name__ == "__main__":
    asyncio.run(main())
