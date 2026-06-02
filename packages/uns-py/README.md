# uns-kit (Python)

Python UNS SDK for runtime services, API/service exposure, and Datahub access. Provides:
- Topic builder compatible with UNS infra topics (`uns-infra/<package>/<version>/<process>/`).
- Async publish/subscribe via MQTT (using `aiomqtt`).
- Process + instance status topics (active/heap/uptime/alive + stats).
- Minimal UNS packet builder/parser (data/table) aligned with TS core.
- Service/API proxy support with Swagger and endpoint registry topics.
- Datahub client support for last-value, single-topic history, and batch range queries.

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

Feature-specific dependencies are exposed as optional extras:
```bash
pip install "uns-kit[api]"
pip install "uns-kit[cron]"
pip install "uns-kit[database]"
pip install "uns-kit[api,cron,database]"
```

Runtime feature APIs mirror the TypeScript surface:
- `await process.create_api_proxy(...)`
- `await process.create_cron_proxy(...)`
- TS-style aliases are also available: `createApiProxy(...)`, `createCrontabProxy(...)`

## Package layout

Public namespaces are organized by capability:

- `uns_kit.core` - runtime, MQTT, config, auth, Datahub client
- `uns_kit.api` - API proxy and data-catalog/service-api helpers
- `uns_kit.cron` - cron proxy
- `uns_kit.database` - config-driven database access

## Quick start
```python
import asyncio
from pathlib import Path
from uns_kit.core import ConfigFile, UnsPacket, UnsProcessParameters, UnsProxyProcess

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

### Recommended publishing pattern
If your service publishes UNS topics, prefer:
- `UnsProxyProcess`
- `await process.create_mqtt_proxy(...)`
- `await proxy.publish_mqtt_message(...)`

That is the default application pattern for generated Python services and the path that also maintains the retained `.../topics` registry used for discovery. Direct `UnsMqttClient` publishing is lower-level and should not be the default service pattern unless you have a specific reason.

### Validity / Liveliness

UNS attributes can declare how the controller decides whether they are live or stale; in most apps this is primarily used to drive UI liveliness/activity indicators. In app-level modeling we use two modes only:

- `interval`: continuously refreshed values (stale after ~2× `expectedIntervalMs`)
- `lifecycle`: event-driven activity that stays active until a defined end value (`lifecycleEndValue`)

```python
await proxy.publish_mqtt_message({
    "topic": "raw/data/",
    "asset": "line-1",
    "objectType": "motor",
    "objectId": "main",
    "attributes": {
        "attribute": "status",
        "data": {"time": "2025-01-01T00:00:00Z", "value": "RUNNING"},
        "validityMode": "lifecycle",
        "lifecycleEndValue": "STOPPED",
    },
})
```

### Counter attributes

Publish cumulative counters as raw counter state. Do not use producer-side
delta modes for new code; `MessageMode.DELTA`, `MessageMode.BOTH`, and gRPC
`value_is_cumulative` are deprecated because producer memory is lost across
service restarts. Datahub history APIs should calculate delta/rate from
persisted rows.

For a `Data` attribute, mark the series directly:

```python
await proxy.publish_mqtt_message({
    "topic": "raw/data/",
    "asset": "line-1",
    "objectType": "energy-resource",
    "objectId": "main",
    "attributes": {
        "attribute": "active-energy-total",
        "description": "Cumulative active energy counter",
        "valueType": "number",
        "presentationKind": "counter",
        "defaultAggregation": "last",
        "counterResetPolicy": "new-value",
        "data": {
            "time": "2026-06-02T12:00:00.000Z",
            "value": 12345.6,
            "uom": "kWh",
            "dataGroup": "metering",
        },
    },
})
```

For a `Table` attribute, keep the table as the source row and mark chartable
counter columns with `tableColumns`:

```python
await proxy.publish_mqtt_message({
    "topic": "raw/data/",
    "asset": "line-1",
    "objectType": "energy-resource",
    "objectId": "main",
    "attributes": {
        "attribute": "measurements",
        "description": "Metering table",
        "tableColumns": [
            {
                "name": "active_energy_total",
                "valueType": "number",
                "presentationKind": "counter",
                "defaultAggregation": "last",
                "counterResetPolicy": "new-value",
            },
        ],
        "table": {
            "time": "2026-06-02T12:00:00.000Z",
            "dataGroup": "metering",
            "columns": [
                {"name": "active_energy_total", "type": "double", "value": 12345.6, "uom": "kWh"},
                {"name": "power", "type": "double", "value": 42.1, "uom": "kW"},
            ],
        },
    },
})
```

### Datahub client (last value + history)

`UnsClient` provides a minimal REST client for the UNS Datahub API, including batch last-value, single-topic catch-all history, and batch range endpoints. For service-to-service access, prefer passing a long-lived service token directly. Use `AuthClient` only when you need user-style login/refresh from `config.json`.

```python
import pandas as pd
from pathlib import Path
from uns_kit.core import ConfigFile, UnsClient
import io

cfg = ConfigFile.load_config(Path("config.json"))
client = UnsClient(
    cfg["uns"]["rest"],
    api_base_path="/api",
    token=cfg["uns"].get("token"),
)

values = client.last_value([
    "raw/data/line-1/motor/main/temperature",
    "raw/data/line-1/motor/main/status",
])
print(values)

history = client.get_attribute_data(
    "sij/acroni/vv/hrm-furnace/equipment/pusher/output-quantity",
    **{
        "from": "2026-05-07T11:17:01.157Z",
        "to": "2026-05-07T11:22:01.157Z",
        "table": "uns_sij_hrm_furnace_data",
        "aggregate": "last",
        "dedupe": False,
    }
)
print(history.records())

custom_data = client.get_data(
    "/projects/project-name/path-to-data/data",
    params={"fromDate": "20260325"},
)
print(custom_data.json())

df = pd.read_parquet(io.BytesIO(data.content))
print(df)

batch_history = client.history(
    [
        "sij/acroni/vv/hrm-furnace/equipment/zone-1/temperature",
        "sij/acroni/vv/hrm-furnace/equipment/zone-2/temperature",
    ],
    **{
        "from": "2026-04-09T06:00:00Z",
        "to": "2026-04-09T07:00:00Z",
        "limit": 500,
    }
)
print(batch_history.by_topic)
```

If your service token comes from an environment variable or secret store, resolve it before constructing the client:

```python
import os
from uns_kit.core import UnsClient

client = UnsClient(
    "https://datahub.example.com",
    token=os.environ["UNS_SERVICE_TOKEN"],
)
```

For larger service API and data-offer examples, use `configure-data-offer`. The scaffold uses `await register_api_catalog(...)` in `src/main.py`, while `src/api_routes.py` holds the `service_apis` and `data_offer_sources` definitions together with their handlers.

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
from uns_kit.core import ConfigFile, InfisicalResolverOptions, SecretResolverOptions

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

## Extend the config schema
Edit `src/config/project_config_extension.py` inside your Python project and run:

```bash
poetry run uns-kit-py generate-config-schema
```

This regenerates `config.schema.json` so editors can validate `config.json`, flag missing required fields, and offer completions for project-specific sections.

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

To add optional feature scaffolding later:
```bash
poetry run uns-kit-py configure-api .
poetry run uns-kit-py configure-cron .
poetry run uns-kit-py configure-data-offer .
```

`configure-api` adds a service-API scaffold:
- `src/main.py`
- `src/api_routes.py`

`configure-data-offer` adds a TypeScript-style API/data-catalog layout:
- `src/main.py`
- `src/api_routes.py`
- `src/data_offers/*.py`
- `src/data_offers/sql/...`

The scaffold includes the same two offer styles as the TypeScript template:
- one JSON offer (`demo_coils`)
- one Parquet export offer (`demo_export`)

### Create a new project from a service bundle
```bash
uns-kit-py create --bundle ./service.bundle.json
uns-kit-py create --bundle ./service.bundle.json --dest ./my-dir
uns-kit-py create --bundle ./service.bundle.json --dest . --allow-existing
```

Bundle-driven create uses `service.bundle.json` as the source of truth. The Python CLI:
- scaffolds the base Python app from the existing default template
- copies the original bundle into the project root as `service.bundle.json`
- generates `SERVICE_SPEC.md` and `AGENTS.md`
- applies supported bundle features such as `vscode` and `devops`

When `--bundle` is used, the default destination is `./<metadata.name>`. The Python CLI only accepts bundles with `scaffold.stack = "python"` and currently supports `scaffold.template = "default"` for this MVP. If the bundle targets TypeScript instead, use `uns-kit create --bundle ...`.

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
- Optional: dictionary/measurement helpers + CLI wrapper.
