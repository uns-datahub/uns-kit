# @uns-kit/api

`@uns-kit/api` exposes Express-based HTTP endpoints for UNS deployments. The plugin attaches a `createApiProxy` method to `UnsProxyProcess`, handles JWT/JWKS access control, and automatically publishes API metadata back into the Unified Namespace.

Note: Apps built with uns-kit are intended to be managed by the **UNS Datahub controller**.
For the MQTT topic registry published by the API plugin, see `../../docs/uns-topics.md`.

## uns-kit in context

uns-kit is a batteries-included toolkit for Unified Namespace applications. It standardizes MQTT wiring, auth, config schemas, and scaffolding so you can focus on your API surface instead of boilerplate. The toolkit packages are:

| Package | Description |
| --- | --- |
| [`@uns-kit/core`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-core) | Base runtime utilities (UnsProxyProcess, MQTT helpers, configuration tooling, gRPC gateway support). |
| [`@uns-kit/api`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-api) | Express plugin that exposes HTTP endpoints, handles JWT/JWKS auth, and republishes API metadata to UNS. |
| [`@uns-kit/cron`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-cron) | Cron-driven scheduler that emits UNS events on a fixed cadence. |
| [`@uns-kit/temporal`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-temporal) | Temporal.io integration that wires workflows into UnsProxyProcess. |
| [`@uns-kit/cli`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-cli) | Command line tool for scaffolding new UNS applications. |

## Installation

```bash
pnpm add @uns-kit/api
# or
npm install @uns-kit/api
```

Make sure `@uns-kit/core` is also installed; the plugin augments its runtime types.

## Example

```ts
import UnsProxyProcess from "@uns-kit/core/uns/uns-proxy-process";
import type { UnsProxyProcessWithApi } from "@uns-kit/api";
import "@uns-kit/api"; // registers the plugin side-effect

async function main() {
  const process = new UnsProxyProcess("mqtt-broker:1883", { processName: "api-gateway" }) as UnsProxyProcessWithApi;

  const api = await process.createApiProxy("gateway", { jwtSecret: "super-secret" });

  api.get("factory/", "status", {
    apiDescription: "Factory status endpoint",
    tags: ["status"],
    queryParams: [
      { name: "from", type: "string", chatCanonical: "from" },
      { name: "to", type: "string", chatCanonical: "to" },
      { name: "limit", type: "number", chatCanonical: "limit", defaultValue: 200 },
    ],
    chatDefaults: {
      limit: 200,
    },
  });

  api.event.on("apiGetEvent", (event) => {
    event.res.json({ status: "ok" });
  });
}

void main();
```

`queryParams[].chatCanonical`, `queryParams[].defaultValue`, and `chatDefaults` are optional.
When provided, they are published into OpenAPI vendor metadata (`x-uns-chat`) so assistant tooling can map canonical chat inputs (`from`, `to`, `limit`, `topic`, ...) to endpoint-specific query parameters.

## Scripts

```bash
pnpm run typecheck
pnpm run build
```

`build` emits both JavaScript and type declarations to `dist/`.

## License

MIT © Aljoša Vister
