import asyncio
from datetime import datetime, timedelta, timezone
from pathlib import Path

from uns_kit import ConfigFile, TopicBuilder, UnsMqttClient, UnsProcessParameters, UnsProxyProcess
from uns_kit.packet import isoformat


async def main() -> None:
    cfg = ConfigFile.load_config(Path("config.json"))
    infra = cfg.get("infra") or {}
    uns = cfg.get("uns") or {}
    host = infra.get("host") or "localhost"
    process_name = uns.get("processName") or "uns-process"
    process = UnsProxyProcess(host, UnsProcessParameters(process_name=process_name))
    await process.start()
    print(f"[data-example] process client connected to {host}:{infra.get('port') or 1883}")

    out = await process.create_mqtt_proxy("py-output")
    out.client.publisher_active = True
    print(f"[data-example] output proxy connected to {host}:{infra.get('port') or 1883}")

    inp = UnsMqttClient(
        host,
        port=infra.get("port"),
        username=infra.get("username") or None,
        password=infra.get("password") or None,
        tls=bool(infra.get("tls")),
        client_id=f"{process_name}-data-example-in",
        topic_builder=TopicBuilder(process_name=process_name),
        instance_name="py-input",
        subscriber_active=True,
    )
    await inp.connect()
    print(f"[data-example] input client connected to {host}:{infra.get('port') or 1883}, subscribing to raw/#")

    topic = "enterprise/site/area/line/"
    asset = "asset"
    asset_description = "Sample asset"
    object_type = "energy-resource"
    object_id = "main"
    data_group = "sensor"

    try:
        async with inp.messages("raw/#") as messages:
            await out.client.publish_raw("raw/data", "", retain=True)
            print("[data-example] cleared retained raw/data; subscribed to 1 topic (raw/#); waiting for incoming raw/data...")

            async for msg in messages:
                payload = msg.payload.decode(errors="replace") if msg.payload else ""
                if str(msg.topic) != "raw/data":
                    continue

                parts = payload.split(",")
                if len(parts) < 3:
                    print(f"[data-example] skip malformed raw/data: {payload}")
                    continue
                try:
                    number_value = float(parts[0])
                    event_time_ms = int(parts[1])
                    sensor_value = float(parts[2])
                except ValueError:
                    print(f"[data-example] parse error, skip: {payload}")
                    continue

                event_time = datetime.fromtimestamp(event_time_ms / 1000, tz=timezone.utc)
                interval_start = isoformat(event_time - timedelta(seconds=1))
                interval_end = isoformat(event_time)
                time = isoformat(event_time)

                await out.publish_mqtt_message(
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
                                    "dataGroup": data_group,
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
                                    "dataGroup": data_group,
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
                print(f"[data-example] published transform at {time}")
    finally:
        await inp.close()
        await out.close()
        await process.stop()


if __name__ == "__main__":
    asyncio.run(main())
