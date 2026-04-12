# UNS Python App Template

## Setup
```bash
poetry install
poetry run python main.py
```

## Recommended publishing pattern
For UNS topic outputs, the default and recommended application pattern is:
- `UnsProxyProcess`
- `await process.create_mqtt_proxy(...)`
- `await output.publish_mqtt_message(...)`

Avoid ad-hoc direct MQTT publishing in normal service code unless there is a special reason. The scaffolded app is intended to be extended from that proxy-based pattern so published UNS topics are also reflected in the retained `.../topics` registry.

## Validity / Liveliness

UNS attributes can declare how the controller decides whether they are live or stale. These fields are optional and default to `"interval"` with the controller default (~120s) if omitted.

- `validityMode`: `"interval" | "lifecycle" | "static"`
- `expectedIntervalMs`: required for `"interval"` mode (controller marks stale after ~2x this interval)
- `lifecycleEndValue`: required for `"lifecycle"` mode (end-state marker, e.g. `"EXITED"`)

Example:

```python
await output.publish_mqtt_message({
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

## Configure (Optional)
```bash
poetry run uns-kit-py configure-vscode .
poetry run uns-kit-py configure-devops .
poetry run uns-kit-py configure-api .
poetry run uns-kit-py configure-cron .
```

`configure-api` copies a FastAPI starter and updates `pyproject.toml` to install `uns-kit` with the `api` extra.
`configure-cron` copies an APScheduler starter and updates `pyproject.toml` to install `uns-kit` with the `cron` extra.
The generated feature examples use `UnsProxyProcess.create_api_proxy(...)` and `create_cron_proxy(...)` so the runtime shape matches the TypeScript packages.

## Publish/Subscribe Helpers
```bash
poetry run uns-kit-py publish --host localhost:1883 --topic raw/data/ --value 1
poetry run uns-kit-py subscribe --host localhost:1883 --topic uns-infra/#
```
These CLI helpers are useful for diagnostics and low-level checks. For application UNS topic outputs, prefer the proxy-based pattern in `main.py`.

## Datahub client (last value)

`UnsClient` provides a minimal REST client for the UNS Datahub API, including the batch last-value endpoint.

```python
from uns_kit import UnsClient

client = UnsClient("https://datahub.example.com", api_base_path="/api")
client.login("service@example.com", "password")

values = client.last_value([
    "raw/data/line-1/motor/main/temperature",
    "raw/data/line-1/motor/main/status",
])
print(values)
```

## Data Example
```bash
poetry run python src/data_example.py
```

## Load test
```bash
poetry run python src/load_test.py
```
The script will prompt for confirmation, iterations, delay, and topic.
Tip: if you run multiple clients at once, avoid reusing the same MQTT clientId.

## Status topics
The default `main.py` starts an `UnsProxyProcess`, creates an output proxy, and publishes a sample UNS topic through that proxy.

## Config
Edit `config.json` with your MQTT host/auth (TS-style nested infra/uns structure).
