# UNS Python App Template

## Setup
```bash
poetry install
poetry run python src/main.py
```

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

## Config
Edit `config.json` with your MQTT host/auth.
