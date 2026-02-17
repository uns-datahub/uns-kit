import asyncio
from datetime import datetime, timedelta, timezone
from pathlib import Path

from uns_kit import ConfigFile, TopicBuilder, UnsMqttClient, UnsProcessParameters, UnsProxyProcess
from uns_kit.packet import isoformat


async def main() -> None:
    cfg_path = Path("config.json")
    cfg = ConfigFile.load_config(cfg_path) if cfg_path.exists() else {"infra": {"host": "localhost"}, "uns": {"processName": "uns-process"}}
    infra = cfg.get("infra") or {}
    uns = cfg.get("uns") or {}
    host = infra.get("host") or "localhost"
    port = infra.get("port")
    process_name = uns.get("processName") or "uns-process"
    process = UnsProxyProcess(host, UnsProcessParameters(process_name=process_name))
    await process.start()
    print("[data-example] Process client connected.")

    mqtt_output = await process.create_mqtt_proxy("py-output")
    print("[data-example] Output proxy connected.")
    mqtt_input = UnsMqttClient(
        host,
        port=port,
        username=infra.get("username") or None,
        password=infra.get("password") or None,
        tls=bool(infra.get("tls")),
        client_id=None,
        topic_builder=TopicBuilder(process_name=process_name),
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
