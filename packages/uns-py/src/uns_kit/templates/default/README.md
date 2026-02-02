# UNS Python App Template

## Setup
```bash
poetry install
poetry run python src/main.py
```

## Data example
```bash
poetry run python src/data_example.py
```
Requires an upstream publisher sending `raw/data` payloads like `count,timestamp,value`.

If you are developing inside the uns-kit monorepo, install the local package first:
```bash
poetry add -e ../packages/uns-py
```

Alternatively, use the script entry point:
```bash
poetry run run publish --host localhost:1883 --topic raw/data/ --value 1
```

## Load test
```bash
poetry run python src/load_test.py
```
The script will prompt for confirmation, iterations, delay, and topic.
Tip: if you run multiple clients at once, avoid reusing the same MQTT clientId.

## Status topics
The default `main.py` uses `UnsProxyProcess` + `UnsMqttProxy`, which publish:
- process status (`.../active`, `.../heap-used`, `.../heap-total`) every 10s
- instance status (`.../<instance>/alive`, `.../<instance>/uptime`, `.../<instance>/t-publisher-active`, `.../<instance>/t-subscriber-active`) every 10s
- transformation stats (`.../<instance>/published-message-*`, `.../<instance>/subscribed-message-*`) every 60s

## Config
Edit `config.json` with your MQTT host/auth (TS-style nested infra/uns structure).
