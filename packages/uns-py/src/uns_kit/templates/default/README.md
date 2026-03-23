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

## Configure (Optional)
```bash
poetry run uns-kit-py configure-vscode .
poetry run uns-kit-py configure-devops .
```

## Publish/Subscribe Helpers
```bash
poetry run uns-kit-py publish --host localhost:1883 --topic raw/data/ --value 1
poetry run uns-kit-py subscribe --host localhost:1883 --topic uns-infra/#
```
These CLI helpers are useful for diagnostics and low-level checks. For application UNS topic outputs, prefer the proxy-based pattern in `main.py`.

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
