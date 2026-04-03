# uns-kit Monorepo

Official UNS toolkit published under the `@uns-kit/*` npm scope. Contains the shared core runtime and pluggable extensions for building realtime microservices on top of the Unified Namespace.

## What is uns-kit?

uns-kit gives teams a consistent, tested foundation for Unified Namespace applications. It standardises:
- MQTT wiring, topic lifecycle, and message processing (`@uns-kit/core`)
- HTTP/REST surfaces with JWT/JWKS auth and Swagger (`@uns-kit/api`)
- Cron-driven scheduled triggers (`@uns-kit/cron`)
- Project scaffolding, config schemas, and schema sync (`@uns-kit/cli`)

Apps scaffolded with uns-kit are managed by the **UNS Datahub controller** (not yet open-sourced).

## Packages

| Package | Description |
| --- | --- |
| [`@uns-kit/core`](packages/uns-core) | Base runtime (UnsProxyProcess, MQTT helpers, config tooling, gRPC gateway). |
| [`@uns-kit/api`](packages/uns-api) | Express plugin — HTTP GET/POST endpoints, JWT/JWKS auth, Swagger, UNS metadata. |
| [`@uns-kit/cron`](packages/uns-cron) | Cron-driven scheduler that emits UNS events on a fixed cadence. |
| [`@uns-kit/cli`](packages/uns-cli) | CLI for scaffolding and maintaining UNS applications. |

> `@uns-kit/temporal` is available but becoming obsolete — prefer `@uns-kit/cron` for scheduled work.

## Quickstart

```bash
pnpm --package=@uns-kit/cli dlx uns-kit create my-uns-app
# or
npx @uns-kit/cli create my-uns-app

cd my-uns-app
pnpm install
pnpm run dev
```

For more templates and configure options see [`@uns-kit/cli`](packages/uns-cli).

## Monorepo structure

- `packages/` — all `@uns-kit/*` packages, each builds and publishes independently.
- `@uns-kit/core` is the runtime foundation; `@uns-kit/api` and `@uns-kit/cron` layer features on top.
- `packages/uns-cli/templates/default/` is the base scaffold; `uns-kit create` copies it and patches placeholders.
- Bumping `@uns-kit/core` automatically updates the CLI's pinned version via `packages/uns-core/scripts/update-cli-core-version.cjs`.
- Consumer apps in the same workspace resolve `@uns-kit/*` to local `packages/*` via `workspace:^` so you can iterate without publishing.

## Root workspace scripts

| Script | Description |
|---|---|
| `ts:version:patch` | Bump patch version for all `@uns-kit/*` packages |
| `ts:build` | Build all TypeScript packages |
| `ts:publish` | Publish all `@uns-kit/*` packages |
| `ts:sandbox:*` | Run sandbox examples (`data`, `load-test`, `table`, `api`, `cron`, `uns-gateway-cli`) |
| `ts:configure:*` | Run CLI configure commands against `sandbox-app` |
| `ts:core:sync-uns-schema` | Pull canonical UNS schema from controller, update repo templates and regenerate TS |
| `py:sandbox:*` | Run Python sandbox examples |
| `py:build` / `py:publish` | Build or publish `uns-py` |

## Sync the canonical UNS schema

To update the repo-maintained schema templates from a running controller:

```bash
pnpm run ts:core:sync-uns-schema
# Controller URL is read from config.json (uns.rest) or UNS_CONTROLLER_URL env var.
# You will be prompted for the bearer token, or set UNS_CONTROLLER_TOKEN.
```

Inside a generated microservice project:

```bash
pnpm run sync-uns-schema
```

This updates `uns-dictionary.json`, `uns-measurements.json`, and regenerates `src/uns/*.generated.ts`.

**Options:**

| Flag | Description |
|---|---|
| `--controller-url <url>` | Override controller base URL |
| `--token <token>` | Admin bearer token (prompted interactively if omitted) |
| `--status active\|draft\|deprecated\|all` | Dictionary filter (default: `active`) |
| `--dry-run` | Report changes without writing |
| `--dictionary-only` / `--measurements-only` | Sync only one export |
| `--skip-generate` | Skip TypeScript regeneration |

## Agent onboarding (AI/code-assist tools)

Projects scaffolded from uns-kit include a local `AGENTS.md` with pointers for AI/code-assist tools.

## License

MIT © Aljoša Vister
