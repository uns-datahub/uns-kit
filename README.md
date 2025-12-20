# uns-kit Monorepo

This repository houses the official UNS toolkit published to npm under the `@uns-kit/*` scope. It contains the shared core runtime and a set of pluggable extensions that make it easier to build realtime transformers on top of the Unified Namespace.

## What is uns-kit?

uns-kit is a batteries-included toolkit for building UNS-aware applications. It standardizes how you:
- connect to MQTT and UNS topics, process messages, and emit events (core runtime),
- expose HTTP/GraphQL surfaces to interact with UNS data (API plugin),
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

## Getting Started

```bash
pnpm install
pnpm typecheck
pnpm build
```

- `pnpm typecheck` runs the TypeScript compiler in no-emit mode for every package.
- `pnpm build` emits JavaScript and declaration files into `packages/*/dist`.

To work on a specific package:

```bash
cd packages/uns-api
pnpm run typecheck
pnpm run build
```

### Scaffolding a New Project

```bash
pnpm --package=@uns-kit/cli dlx uns-kit create my-uns-app
# or with npx
npx @uns-kit/cli create my-uns-app
cd my-uns-app
pnpm install
pnpm run dev
```

Optional tooling setup (run inside the generated project):

```bash
uns-kit configure-devops
pnpm install
pnpm run pull-request

uns-kit configure-vscode

uns-kit configure-codegen
pnpm install
pnpm run codegen
pnpm run refresh-uns

uns-kit configure-api
uns-kit configure-cron
uns-kit configure-temporal
uns-kit configure-python
pnpm install
```

Keep your project schema aligned by editing `src/config/project.config.extension.ts` and running `pnpm run generate-config-schema` inside the generated app. The command refreshes both `config.schema.json` and `src/config/app-config.ts`, which augments `@uns-kit/core`'s `AppConfig`. Reload your editor's TypeScript server if completions lag behind.

## Publishing

1. Update versions in the relevant `package.json` files.
2. Run `pnpm build` to generate the `dist/` folders.
3. Publish with pnpm (example for the API package):
   ```bash
   pnpm publish --filter @uns-kit/api --access public
   ```

Repeat for the other packages as needed. Each package `package.json` already includes the correct metadata (license, repository, keywords, etc.).

## License

MIT © Aljoša Vister
