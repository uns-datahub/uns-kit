# @uns-kit/api

`@uns-kit/api` exposes Express-based HTTP endpoints for UNS deployments. The plugin attaches a `createApiProxy` method to `UnsProxyProcess`, handles JWT/JWKS access control, and automatically publishes API metadata back into the Unified Namespace.

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
  });

  api.event.on("apiGetEvent", (event) => {
    event.res.json({ status: "ok" });
  });
}

void main();
```

## Scripts

```bash
pnpm run typecheck
pnpm run build
```

`build` emits both JavaScript and type declarations to `dist/`.

## License

MIT © Aljoša Vister
