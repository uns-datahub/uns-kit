# uns-kit Monorepo

This repository houses the official UNS toolkit published to npm under the `@uns-kit/*` scope. It contains the shared core runtime and a set of pluggable extensions that make it easier to build realtime transformers on top of the Unified Namespace.

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
pnpm install
```

Keep your project schema aligned by editing `src/config/project.config.extension.ts` and running `pnpm run generate-config-schema` inside the generated app.

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
