# @uns-kit/core

Core utilities and runtime building blocks for Unified Namespace (UNS) applications. The package bundles the process lifecycle manager, MQTT integrations, gRPC gateway helpers, configuration tooling, and shared type definitions that power the UNS ecosystem.

Note: Apps built with uns-kit are intended to be managed by the **UNS Datahub controller**.

## uns-kit in context

| Package | Description |
| --- | --- |
| [`@uns-kit/core`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-core) | Base runtime (UnsProxyProcess, MQTT helpers, config tooling, gRPC gateway). |
| [`@uns-kit/api`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-api) | Express plugin — HTTP endpoints, JWT/JWKS auth, Swagger, UNS metadata. |
| [`@uns-kit/cron`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-cron) | Cron-driven scheduler that emits UNS events on a fixed cadence. |
| [`@uns-kit/cli`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-cli) | CLI for scaffolding new UNS applications. |

## Installation

```bash
pnpm add @uns-kit/core
# or
npm install @uns-kit/core
```

## Key concepts

- **UnsProxyProcess** — the central runtime class. It manages the MQTT connection, plugin lifecycle, and the instance status topic. Plugins (`@uns-kit/api`, `@uns-kit/cron`) augment it with domain-specific proxy factories.
- **UnsProxy** — base class extended by all plugin proxies. Tracks produced topics, API endpoints, and catch-all mappings; re-publishes them to the controller on a 60-second cadence.
- **ConfigFile** — loads and validates `config.json` at startup. On a real server this file is provided by the UNS Datahub controller; in development you maintain it yourself.
- **MQTT helpers** — resilient publishers, topic builders, throttled queues, and handover support.
- **gRPC gateway** — infrastructure to bridge Python workers into the UNS message fabric.

## Basic usage

```ts
import UnsProxyProcess from "@uns-kit/core/uns/uns-proxy-process";
import { ConfigFile } from "@uns-kit/core";

const config = await ConfigFile.loadConfig();

// Connect to MQTT broker; processName identifies this service in the controller.
const proc = new UnsProxyProcess(config.infra.host!, { processName: config.uns.processName });
```

Extend it with plugins:

```ts
import "@uns-kit/api";
import "@uns-kit/cron";
import { type UnsProxyProcessWithApi } from "@uns-kit/api";
import { type UnsProxyProcessWithCron } from "@uns-kit/cron";

const proc = new UnsProxyProcess(config.infra.host!, { processName: config.uns.processName })
  as UnsProxyProcessWithApi & UnsProxyProcessWithCron;

const api  = await proc.createApiProxy("my-service", { jwtSecret: "CHANGEME" });
const cron = await proc.createCrontabProxy("*/5 * * * *", { event: "tick" });
```

## Sync UNS schema from the controller

`sync-uns-schema` fetches the canonical UNS dictionary and measurements from the controller REST API and refreshes local JSON files and generated TypeScript artifacts.

```bash
# Run inside a generated microservice project:
pnpm run sync-uns-schema

# The controller URL is read from config.json (uns.rest) automatically.
# You will be prompted for the bearer token if not set via env var.
```

Or with explicit options:

```bash
pnpm run sync-uns-schema --controller-url http://localhost:3200 --token <bearer-token>
```

**What it updates (inside a generated project):**
- `uns-dictionary.json`
- `uns-measurements.json`
- `src/uns/uns-dictionary.generated.ts`
- `src/uns/uns-measurements.generated.ts`

**Options:**

| Flag | Default | Description |
|---|---|---|
| `--controller-url` | from `config.json` `uns.rest` or `UNS_CONTROLLER_URL` | Controller base URL |
| `--token` | interactive prompt or `UNS_CONTROLLER_TOKEN` | Admin bearer token |
| `--status` | `active` | Dictionary filter: `active`, `draft`, `deprecated`, `all` |
| `--dry-run` | — | Report changes without writing |
| `--dictionary-only` | — | Skip measurements sync |
| `--measurements-only` | — | Skip dictionary sync |
| `--skip-generate` | — | Skip TS regeneration |
| `--project-root <dir>` | auto-detect | Target project root |

## Config schema generation

Edit `src/config/project.config.extension.ts` inside your project and run:

```bash
pnpm run generate-config-schema
```

This regenerates `config.schema.json` and `src/config/app-config.ts`, keeping editor completions and runtime types in sync with your config extensions.

## Infisical secret resolution

- Looks for `INFISICAL_TOKEN` / `INFISICAL_PERSONAL_TOKEN`, then `/run/secrets/infisical_token`.
- If unavailable, logs a warning and returns `default` (or `undefined` for `optional: true` secrets).
- Required secrets throw with the original error message when Infisical is unreachable.
- Call `resolveInfisicalConfig()` to inspect the resolved token/projectId/siteUrl.

## Development

```bash
pnpm run typecheck   # type-check sources
pnpm run build       # emit JS + declarations to dist/
```

## License

MIT © Aljoša Vister
