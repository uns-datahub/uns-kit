# @uns-kit/core

Core utilities and runtime building blocks for building Unified Namespace (UNS) realtime transformers. The package bundles the process lifecycle manager, MQTT integrations, gRPC gateway helpers, configuration tooling, and shared type definitions that power the UNS ecosystem.

## Installation

```bash
pnpm add @uns-kit/core
# or
npm install @uns-kit/core
```

## Key Features

- **UnsProxyProcess** – plugin-ready runtime for managing UNS proxy instances and MQTT wiring.
- **MQTT helpers** – resilient publishers, topic builders, throttled queues, and handover support.
- **Configuration utilities** – Zod-powered config schema generation and secret resolution helpers.
- **gRPC gateway helpers** – infrastructure to bridge Python workers into the UNS message fabric.
- **GraphQL tooling** – utilities such as `refresh-uns` that rebuild UNS topic/tag unions from your environment.

## Usage

Most projects start by creating an `UnsProxyProcess` and registering plugins:

```ts
import UnsProxyProcess from "@uns-kit/core/uns/uns-proxy-process";

const process = new UnsProxyProcess("mqtt-broker.svc:1883", { processName: "my-rtt" });
```

See the individual plugin packages (`@uns-kit/cron`, `@uns-kit/api`, `@uns-kit/temporal`) for examples on extending the process with runtime capabilities.

### Refresh UNS topic/tag unions

The package ships a CLI tool that regenerates strongly-typed UNS topics and tags based on the live GraphQL schema:

```bash
pnpm run refresh-uns
```

When configured via `uns-kit configure-codegen`, this script lives in your project `package.json` and writes into `src/uns/`.

### Generate UNS dictionary (object types & attributes with descriptions)

Use `packages/uns-core/src/tools/generate-uns-dictionary.ts` to turn a JSON dictionary into a TypeScript helper. No network or GraphQL calls are involved.

```bash
pnpm tsx packages/uns-core/src/tools/generate-uns-dictionary.ts \ 
  --input uns-dictionary.json \            # base JSON
  --output src/uns/uns-dictionary.generated.ts \ 
  --lang sl                                # pick language code from descriptions
```

- Reads the provided JSON and emits TypeScript constants, description maps, and helper getters for IntelliSense and metadata emission.

To generate both dictionary and measurements in one step, use the wrapper:

```bash
pnpm tsx packages/uns-core/src/tools/generate-uns-reference.ts \
  --dictionary uns-dictionary.json \
  --dictionary-output src/uns/uns-dictionary.generated.ts \
  --measurements uns-measurements.json \
  --measurements-output src/uns/uns-measurements.generated.ts \
  --lang sl
```

### Infisical secret resolution in development

- The resolver looks for `SecretResolverOptions.infisical.fetchSecret`, then `INFISICAL_TOKEN`/`INFISICAL_PERSONAL_TOKEN`, then `/run/secrets/infisical_token` (or `/var/lib/uns/secrets/infisical_token`).
- If no fetcher/token is available, the resolver now logs a warning and returns the placeholder `default`, or `undefined` when `optional: true`; required secrets still trigger `onMissingSecret` before throwing.
- If Infisical is configured but the host is unreachable (e.g., DNS/network failure), the resolver warns and falls back to the same `default`/`optional` handling, reusing a cached value when present; required secrets throw with the original error message.
- To inspect what would be used, call `resolveInfisicalConfig()` to get `{ token, projectId, siteUrl }` via the same lookup rules.
- Use this to run locally without Infisical: mark dev-only secrets as `optional` or give `default` values, and provide real tokens only in production.

## Development

```bash
# Lint and type-check the sources
pnpm run typecheck

# Emit JavaScript and declaration files to dist/
pnpm run build
```

## License

MIT © Aljoša Vister
