# @uns-kit/api

`@uns-kit/api` exposes Express-based HTTP endpoints for UNS deployments. The plugin attaches a `createApiProxy` method to `UnsProxyProcess`, handles JWT/JWKS access control, automatically publishes API metadata back into the Unified Namespace, and serves a Swagger UI for every registered endpoint.

Note: Apps built with uns-kit are intended to be managed by the **UNS Datahub controller**.
For the MQTT topic registry published by the API plugin, see `../../docs/uns-topics.md`.

## uns-kit in context

| Package | Description |
| --- | --- |
| [`@uns-kit/core`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-core) | Base runtime (UnsProxyProcess, MQTT helpers, config tooling, gRPC gateway). |
| [`@uns-kit/api`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-api) | Express plugin — HTTP endpoints, JWT/JWKS auth, Swagger, UNS metadata. |
| [`@uns-kit/cron`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-cron) | Cron-driven scheduler that emits UNS events on a fixed cadence. |
| [`@uns-kit/cli`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-cli) | CLI for scaffolding new UNS applications. |

## Installation

```bash
pnpm add @uns-kit/api
# or
npm install @uns-kit/api
```

`@uns-kit/core` must also be present — the plugin augments its `UnsProxyProcess` type.

## How it works

1. Import `@uns-kit/api` as a side-effect to register the plugin.
2. Call `process.createApiProxy(instanceName, options)` to start an Express server.
3. Register endpoints with `api.get(...)` or `api.post(...)`.
4. Listen to `apiGetEvent` / `apiPostEvent` to handle incoming requests.

Every registered endpoint is:
- Automatically secured with JWT/JWKS or a shared secret.
- Published to the UNS controller as an API metadata record (topic, host, path, method).
- Added to the Swagger spec served at `/<processName>/<instanceName>/swagger.json`.

## GET endpoint example

```ts
import UnsProxyProcess from "@uns-kit/core/uns/uns-proxy-process";
import type { UnsEvents } from "@uns-kit/core";
import "@uns-kit/api";
import { type UnsProxyProcessWithApi } from "@uns-kit/api";

const config = await ConfigFile.loadConfig();
const proc = new UnsProxyProcess(config.infra.host!, { processName: config.uns.processName }) as UnsProxyProcessWithApi;

const api = await proc.createApiProxy("my-service", {
  jwks: { wellKnownJwksUrl: config.uns.jwksWellKnownUrl },
  // or for simple/dev deployments: jwtSecret: "CHANGEME"
});

// Register a GET endpoint
// Signature: api.get(topic, asset, objectType, objectId, attribute, options?)
await api.get(
  "enterprise/site/area/line/",
  "line-3-furnace",
  "energy-resource",
  "main-bus",
  "current",
  {
    tags: ["Energy"],
    apiDescription: "Current reading for line-3-furnace main-bus",
    queryParams: [
      { name: "from",  type: "string", required: false, description: "Start of time range (ISO 8601)", chatCanonical: "from" },
      { name: "to",    type: "string", required: false, description: "End of time range (ISO 8601)",   chatCanonical: "to"   },
      { name: "limit", type: "number", required: false, description: "Maximum records",                chatCanonical: "limit", defaultValue: 100 },
    ],
    chatDefaults: { limit: 100 },
  }
);

// Handle incoming GET requests
api.event.on("apiGetEvent", (event: UnsEvents["apiGetEvent"]) => {
  const { from, to, limit } = event.req.query;
  // fetch your data here
  event.res.json({ status: "ok", data: [] });
});
```

## POST endpoint example

```ts
// Register a POST endpoint
// Signature: api.post(topic, asset, objectType, objectId, attribute, options?)
await api.post(
  "enterprise/site/area/line/",
  "line-3-furnace",
  "energy-resource",
  "main-bus",
  "setpoint",
  {
    tags: ["Energy"],
    apiDescription: "Write a new setpoint for line-3-furnace main-bus",
    requestBody: {
      description: "Setpoint payload",
      required: true,
      schema: {
        type: "object",
        required: ["value"],
        properties: {
          value: { type: "number", description: "Target setpoint value" },
          unit:  { type: "string", description: "Unit of measurement, e.g. A" },
        },
      },
    },
  }
);

// Handle incoming POST requests — body is pre-parsed JSON
api.event.on("apiPostEvent", (event: UnsEvents["apiPostEvent"]) => {
  const { value, unit } = event.req.body;
  // write/command logic here
  event.res.json({ status: "ok", received: { value, unit } });
});
```

## Endpoint signature

```
api.get(topic, asset, objectType, objectId, attribute, options?)
api.post(topic, asset, objectType, objectId, attribute, options?)
```

| Parameter | Type | Description |
|---|---|---|
| `topic` | `UnsTopics` | UNS topic path prefix (e.g. `"enterprise/site/area/line/"`) |
| `asset` | `UnsAsset` | Asset identifier (e.g. `"line-3-furnace"`) |
| `objectType` | `UnsObjectType` | UNS object type (e.g. `"energy-resource"`) |
| `objectId` | `UnsObjectId` | Object instance id (e.g. `"main-bus"`) |
| `attribute` | `UnsAttribute` | Attribute name (e.g. `"current"`) |
| `options` | `IGetEndpointOptions` / `IPostEndpointOptions` | Tags, description, query params / request body |

## Auth options

| Option | When to use |
|---|---|
| `jwks.wellKnownJwksUrl` | Production — verifies RS256 tokens from the UNS controller JWKS endpoint |
| `jwks.activeKidUrl` | Optional companion to JWKS — narrows which key ID is active |
| `jwtSecret` | Development / simple deployments — symmetric secret |

Requests that fail auth return `401 Unauthorized`. Requests whose token `accessRules` do not match the endpoint path return `403 Forbidden`.

## Unregistering an endpoint

```ts
await api.unregister(topic, asset, objectType, objectId, attribute, "GET");
await api.unregister(topic, asset, objectType, objectId, attribute, "POST");
```

This removes the route from Express, the Swagger spec, and the internal UNS endpoint registry.

## registerCatchAll (uns-api-global only)

`api.registerCatchAll()` is reserved for the **uns-api-global** microservice, which acts as a
catch-all gateway for an entire topic namespace. **Regular microservices must not call this** —
use `api.get()` / `api.post()` for per-attribute endpoints instead.

## Scripts

```bash
pnpm run typecheck
pnpm run build
```

`build` emits both JavaScript and type declarations to `dist/`.

## License

MIT © Aljoša Vister
