# UNS Python App Template

## Setup
```bash
poetry install
poetry run python main.py
```

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
The default `main.py` publishes a startup heartbeat to `raw/data/`.

## Config
Edit `config.json` with your MQTT host/auth (TS-style nested infra/uns structure).
