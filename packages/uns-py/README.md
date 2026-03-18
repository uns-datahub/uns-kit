# uns-kit (Python)

Lightweight UNS MQTT client for Python. Provides:
- Topic builder compatible with UNS infra topics (`uns-infra/<package>/<version>/<process>/`).
- Async publish/subscribe via MQTT (using `aiomqtt`).
- Process + instance status topics (active/heap/uptime/alive + stats).
- Minimal UNS packet builder/parser (data/table) aligned with TS core.

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
```

## Quick start
```python
import asyncio
from pathlib import Path
from uns_kit import ConfigFile, UnsPacket, UnsProcessParameters, UnsProxyProcess

async def main():
    config = ConfigFile.load_config(Path("config.json"))
    infra = config["infra"]
    uns = config["uns"]
    process = UnsProxyProcess(
        infra["host"],
        UnsProcessParameters(process_name=uns.get("processName", "uns-process")),
    )
    await process.start()
    mqtt = await process.create_mqtt_proxy("py")

    # Subscribe
    async with mqtt.client.messages("uns-infra/#") as messages:
        await mqtt.publish_packet("raw/data/", UnsPacket.data(value=1, uom="count"))
        msg = await messages.__anext__()
        print(msg.topic, msg.payload.decode())

    await mqtt.close()
    await process.stop()

asyncio.run(main())
```

## Config placeholders (env + Infisical)
`uns-py` now resolves config placeholders in the same style as `uns-core`.
For Infisical placeholders, install the optional extra:
```bash
pip install "uns-kit[infisical]"
```

Example `config.json`:
```json
{
  "uns": {
    "graphql": "https://example/graphql",
    "rest": "https://example/rest",
    "email": "service@example.com",
    "password": { "provider": "env", "key": "UNS_PASSWORD" },
    "processName": "my-process"
  },
  "infra": {
    "host": "mqtt.example.local",
    "port": 1883,
    "username": "mqtt-user",
    "password": {
      "provider": "infisical",
      "path": "/mqtt",
      "key": "password",
      "environment": "dev"
    }
  }
}
```

Load resolved config with cache semantics:
```python
from uns_kit import ConfigFile, SecretResolverOptions, InfisicalResolverOptions

resolved = ConfigFile.load_config(
    "config.json",
    SecretResolverOptions(
        infisical=InfisicalResolverOptions(
            environment="dev",
            project_id="your-project-id"
        )
    )
)
```

### Resilient subscriber
```python
async for msg in client.resilient_messages("uns-infra/#"):
    print(msg.topic, msg.payload.decode())
```

### Examples
- `examples/publish.py` — publish 5 data packets.
- `examples/subscribe.py` — resilient subscription with auto-reconnect.
- `examples/load_test.py` — interactive publish burst.

### Create a new project
```bash
uns-kit-py create my-uns-py-app
cd my-uns-py-app
poetry install
poetry run python src/main.py
```

### Create a sandbox app in this repo
From the monorepo root:
```bash
pnpm run py:sandbox
```
This creates `sandbox-app-py/` using the default Python template.
When created inside this monorepo, `pyproject.toml` is automatically set to use local editable `uns-kit`:
`uns-kit = { path = "../packages/uns-py", develop = true }`.

## Notes
- Default QoS is 0.
- Instance status topics are published every 10 seconds; stats every 60 seconds.
- Packet shape mirrors the TypeScript core: `{"version":"1.3.0","message":{"data":{...}},"sequenceId":0}`.
- Windows: the library sets `WindowsSelectorEventLoopPolicy()` to avoid `add_reader/add_writer` `NotImplementedError`.

## TODO (parity with TS core)
- Handover manager parity: subscribe to wildcard `active` and `handover` topics, keep new instances passive until timeout or handover completion, and support `handover_intent`, `handover_request`, `handover_subscriber`, `handover_fin`, and `handover_ack`.
- Publish throttling / queue parity: add buffered ordered publishing instead of direct proxy-path publish, plus publisher/subscriber active-passive controls and passive-drain behavior.
- Status parity: add process-level `alive` and `uptime`, publisher/subscriber active flags everywhere, published/subscribed message count and byte metrics, and process identity on active status packets.
- API endpoints registry: mirror `@uns-kit/api` produced endpoints when Python gets an API surface, and use full UNS identity for endpoint keys and paths: `topic + asset + objectType + objectId + attribute`.
- Optional: dictionary/measurement helpers + CLI wrapper.
