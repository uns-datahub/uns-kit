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
### `data_transformer.py`

Transforms incoming sensor data and republishes it to a target topic.

-   **Description:**  
    Subscribes to `sensors/temperature`, applies a transformation (e.g., scales the value), and republishes it as processed data.
    
-   **Example:**
    
    ```bash
    python python/examples/data_transformer.py
    ```
    
    Transforms data from `sensors/temperature` and republishes to `sensors/temperature/room1` it with a modified value.
    

---

### `data_subscribe.py`

Subscribes to topics via the gateway and prints received messages.

-   **Description:**  
    Useful for monitoring live data updates.
    
-   **Example:**
    
    ```bash
    python python/examples/data_subscribe.py
    ```
    
    Prints all messages received from `sensors/temperature`.
    

---

### `data_publish.py`

Publishes a single data point to a UNS topic.

-   **Description:**  
    Sends a single temperature measurement (e.g., 22.5 °C) to the gateway, waits 10 seconds, then exits.
    
-   **Example:**
    
    ```bash
    python python/examples/data_publish.py
    ```
    
    Publishes one temperature value to `sensors/temperature/room1`.
    

---

### `table_transformer.py`

Publishes a structured table-like JSON object as UNS table data.

-   **Description:**  
    Sends summarized or grouped sensor data (e.g., temperature, humidity, status) to a topic.
    
-   **Example:**
    
    ```bash
    python python/examples/dtable_transformer.py
    ```
    
    Publishes a table with room statistics (temperature, humidity, etc.) to `sensors/summary/room1`.
    

---

### `api_handler.py`

Registers and handles an example API endpoint for querying data.

-   **Description:**  
    Demonstrates registering an API endpoint (`example/summary-1`) with query parameters and returning JSON responses.
    
-   **Example:**
    
    ```bash
    python python/examples/api_handler.py
    ```
    
    Then test it with:
    
    ```bash
    http://<gateway-host>:<gateway-port>/api/example/summary-1?filter=test&limit=10
    ```

## Auth

- If `config.json` sets `uns.jwksWellKnownUrl`, the gateway enforces JWT via JWKS (and path rules), matching UnsApiProxy behavior.
- Otherwise, it uses a dev `jwtSecret` ("CHANGEME"). For local testing, you can:
  - Remove JWKS settings in `config.json` and rely on the dev secret, or
  - Provide a valid Bearer token as required by your environment.

## Notes

- The gateway binds to `--addr` or the `UNS_GATEWAY_ADDR` env var. Examples pass `--addr` explicitly.
- On Unix/macOS, a stable UDS path (e.g., `/tmp/uns-gateway.sock`) is recommended for simplicity.
- All examples will auto-start the gateway when `--auto` is used.
