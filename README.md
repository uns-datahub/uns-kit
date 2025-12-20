# uns-kit Monorepo

This repository houses the official UNS toolkit published to npm under the `@uns-kit/*` scope. It contains the shared core runtime and a set of pluggable extensions that make it easier to build realtime transformers on top of the Unified Namespace.

## What is uns-kit?

uns-kit is a batteries-included toolkit for building UNS-aware applications. It standardizes how you:
- connect to MQTT and UNS topics, process messages, and emit events (core runtime),
- expose HTTP/REST surfaces to interact with UNS data (API plugin),
- trigger UNS events on schedules (cron plugin),
- orchestrate workflows with Temporal.io while speaking UNS (temporal plugin),
- scaffold new projects with sensible defaults, codegen hooks, and config schemas (CLI).

The goal is to give teams a consistent, tested foundation for the Unified Namespace so you can focus on your domain logic instead of wiring, auth, and boilerplate.

## Monorepo Overview

- Package scope: everything lives under `packages/` and is wired together with a pnpm workspace. Packages build independently and can be published individually.
- Core vs plugins: `@uns-kit/core` is the runtime foundation; `@uns-kit/api`, `@uns-kit/cron`, and `@uns-kit/temporal` layer features on top of it.
- CLI: `@uns-kit/cli` scaffolds new apps from `packages/uns-cli/templates/default`, then patches placeholders (name, config identifiers, dependency specifiers) when you run `uns-kit create`.
- Version flow: bumping `@uns-kit/core` updates the CLI’s pinned core version (see `packages/uns-core/scripts/update-cli-core-version.cjs`), keeping generated projects aligned with the latest core release.
- Linked projects: when you develop a consumer app in the same pnpm workspace, dependencies resolve to local `packages/*` via `workspace:^` specifiers, so you can iterate on toolkit changes without publishing.

## Packages

| Package | Description |
| --- | --- |
| [`@uns-kit/core`](packages/uns-core) | Base runtime utilities (UnsProxyProcess, MQTT helpers, configuration tooling, gRPC gateway support). |
| [`@uns-kit/api`](packages/uns-api) | Express plugin that exposes HTTP endpoints, handles JWT/JWKS auth, and republishes API metadata to UNS. |
| [`@uns-kit/cron`](packages/uns-cron) | Cron-driven scheduler that emits UNS events on a fixed cadence. |
| [`@uns-kit/temporal`](packages/uns-temporal) | Temporal.io integration that wires workflows into UnsProxyProcess. |
| [`@uns-kit/cli`](packages/uns-cli) | Command line tool for scaffolding new UNS applications. |

Each package is published independently to npm and can be consumed à la carte.

## Getting Started (new project)

- Scaffold a new UNS app with the CLI (no global install required):
  ```bash
  pnpm --package=@uns-kit/cli dlx uns-kit create my-uns-app
  # or with npx
  npx @uns-kit/cli create my-uns-app
  ```
- Then: `cd my-uns-app && pnpm install && pnpm run dev`.
- For more templates and configure options, see the CLI docs: [`@uns-kit/cli`](packages/uns-cli).

## License

MIT © Aljoša Vister
