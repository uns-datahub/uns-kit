# uns-kit (Python)

Lightweight UNS MQTT client for Python. Provides:
- Topic builder compatible with UNS infra topics (`uns-infra/<package>/<version>/<process>/`).
- Async publish/subscribe via MQTT v5 (using `asyncio-mqtt`).
- Infra status topics (`alive`, `uptime`) with MQTT will.
- Minimal UNS packet builder/parser (data/table).

## Install (editable)
```bash
cd packages/uns-py
poetry install
```

## CLI
After `poetry install`, an `uns-kit-py` command is available (renamed to avoid clashing with the Node CLI):
```bash
poetry run uns-kit-py publish --host localhost:1883 --topic raw/data/ --value 1
poetry run uns-kit-py subscribe --host localhost:1883 --topic 'uns-infra/#'
poetry run uns-kit-py write-config --path config.json
```

## Quick start
```python
import asyncio
from uns_kit import UnsMqttClient, TopicBuilder, UnsPacket

async def main():
    tb = TopicBuilder(package_name="uns-kit", package_version="0.0.1", process_name="py-demo")
    client = UnsMqttClient(host="mqtt-broker", topic_builder=tb, reconnect_interval=1)
    await client.connect()

    # Subscribe
    async with client.messages("uns-infra/#") as messages:
        await client.publish_packet("raw/data/", UnsPacket.data(value=1, uom="count"))
        msg = await messages.__anext__()
        print(msg.topic, msg.payload.decode())

    await client.close()

asyncio.run(main())
```

### Resilient subscriber
```python
async for msg in client.resilient_messages("uns-infra/#"):
    print(msg.topic, msg.payload.decode())
```

### Examples
- `examples/publish.py` — publish 5 data packets.
- `examples/subscribe.py` — resilient subscription with auto-reconnect.

### Create a new project
```bash
uns-kit-py create my-uns-py-app
cd my-uns-py-app
poetry install
poetry run python src/main.py
```

## Notes
- Default QoS is 0; will message is retained on `<statusTopic>alive`.
- Uptime is published every 10 seconds on `<statusTopic>uptime`.
- Packet shape mirrors the TypeScript core: `{"version":1,"message":{"data":{...}},"sequenceId":0}`.
