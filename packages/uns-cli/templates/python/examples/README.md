# Python Examples for the UNS gRPC Gateway

These examples demonstrate how to use the Node-based UNS Gateway (MQTT + UNS infra) from Python via gRPC. They mirror the TypeScript examples for data, table, cron-like publishing, and API endpoints.

The gateway centralizes all UNS rules (packet format, sequenceId, interval, produced topics, handover). Python focuses on business logic and ML/ETL while calling the gateway.

## Prerequisites

- Build the Node project once: `npm run build`
- Generate Python stubs and venv: `cd python && ./scripts/setup.sh && source venv/bin/activate`
- Ensure `config.json` is present at repo root (Node gateway reads brokers and UNS options from it)

## Gateway Address

- If `--addr` is omitted, each script auto‑generates a unique address:
  - Unix/macOS: `unix:/tmp/uns-gateway-<script>-<pid>.sock`
  - Windows: `127.0.0.1:<ephemeral_port>`
- You can still pass an explicit `--addr` if you want a fixed address.

All examples accept `--addr` and `--auto`. With `--auto`, the example will spawn the gateway via `npm run gateway` and wait until it's ready.

Imports note: Examples add the generated stubs folder (`python/gen`) to `sys.path` so you can run them from the repo root or from the `python/` folder. Ensure you’ve run `./scripts/setup.sh` so `gen` exists.

Readiness: Examples call the gateway’s `Ready()` RPC to wait for the requested components (publisher/subscriber/API) to be active before publishing or subscribing. No manual sleeps are required.

## Common Flags

- `--addr`: Gateway address (`unix:/path.sock` or `host:port`)
- `--auto`: Auto-start the gateway if not running

## Scripts

- `data_transformer.py`
  - Subscribes to input topics (default `raw/#`) and publishes UNS data packets (`example/` + `data-number`).
  - Examples:
    - Unix/macOS: `python python/examples/data_transformer.py --addr unix:/tmp/uns-gateway.sock --auto --in raw/# --out-topic example/ --attribute data-number --uom mV --group electricity`
    - Windows: `python python/examples/data_transformer.py --addr 127.0.0.1:50051 --auto --in raw/# --out-topic example/ --attribute data-number --uom mV --group electricity`

- `table_transformer.py`
  - Subscribes to `integration/raw-table` JSON and publishes a UNS table packet (`example/factory-a/line-1/` + `table-sample`).
  - Examples:
    - Unix/macOS: `python python/examples/table_transformer.py --addr unix:/tmp/uns-gateway.sock --auto --in-topic integration/raw-table --out-topic example/factory-a/line-1/ --attribute table-sample`
    - Windows: `python python/examples/table_transformer.py --addr 127.0.0.1:50051 --auto --in-topic integration/raw-table --out-topic example/factory-a/line-1/ --attribute table-sample`

- `data_publisher_loop.py`
  - Cron-like loop that publishes a data value periodically (default 1000 ms).
  - Examples:
    - Unix/macOS: `python python/examples/data_publisher_loop.py --addr unix:/tmp/uns-gateway.sock --auto --out-topic example/ --attribute data-number --uom mV --period-ms 1000`
    - Windows: `python python/examples/data_publisher_loop.py --addr 127.0.0.1:50051 --auto --out-topic example/ --attribute data-number --uom mV --period-ms 1000`

- `data_publish_once.py`
  - Sends a single UNS data packet.
  - Examples:
    - Unix/macOS: `python python/examples/data_publish_once.py --addr unix:/tmp/uns-gateway.sock --auto --out-topic example/ --attribute data-number --value 42 --uom mV --group electricity`
    - Windows: `python python/examples/data_publish_once.py --addr 127.0.0.1:50051 --auto --out-topic example/ --attribute data-number --value 42 --uom mV --group electricity`

- `data_subscribe.py`
  - Subscribes to topics via the gateway and prints messages.
  - Examples:
    - Unix/macOS: `python python/examples/data_subscribe.py --addr unix:/tmp/uns-gateway.sock --auto raw/# some/other/topic`
    - Windows: `python python/examples/data_subscribe.py --addr 127.0.0.1:50051 --auto raw/# some/other/topic`

- `api_register_and_serve.py`
  - Registers `/api/example/summary-1` and `/api/example/summary-2` endpoints and serves requests over a bidirectional stream.
  - Examples:
    - Unix/macOS: `python python/examples/api_register_and_serve.py --addr unix:/tmp/uns-gateway.sock --auto`
    - Windows: `python python/examples/api_register_and_serve.py --addr 127.0.0.1:50051 --auto`
    - Then call: `http://<gateway-host>:<gateway-port>/api/example/summary-1?filter=foo&limit=10`

- `api_handler.py`
  - Another API handler demo that returns structured JSON responses. Similar to `api_register_and_serve.py`.

## Auth

- If `config.json` sets `uns.jwksWellKnownUrl`, the gateway enforces JWT via JWKS (and path rules), matching UnsApiProxy behavior.
- Otherwise, it uses a dev `jwtSecret` ("CHANGEME"). For local testing, you can:
  - Remove JWKS settings in `config.json` and rely on the dev secret, or
  - Provide a valid Bearer token as required by your environment.

## Notes

- The gateway binds to `--addr` or the `UNS_GATEWAY_ADDR` env var. Examples pass `--addr` explicitly.
- On Unix/macOS, a stable UDS path (e.g., `/tmp/uns-gateway.sock`) is recommended for simplicity.
- All examples will auto-start the gateway when `--auto` is used.
