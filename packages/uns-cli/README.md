# @uns-kit/cli

Command line scaffolding tool for the UNS toolkit. It bootstraps a new project with `@uns-kit/core` preconfigured and ready to extend with additional plugins.

Note: Apps built with uns-kit are intended to be managed by the **UNS Datahub controller**.

## uns-kit in context

uns-kit is a batteries-included toolkit for Unified Namespace applications. It standardizes MQTT wiring, auth, config schemas, and scaffolding so you can focus on your domain logic. The toolkit packages are:

| Package | Description |
| --- | --- |
| [`@uns-kit/core`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-core) | Base runtime utilities (UnsProxyProcess, MQTT helpers, configuration tooling, gRPC gateway support). |
| [`@uns-kit/api`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-api) | Express plugin that exposes HTTP endpoints, handles JWT/JWKS auth, and republishes API metadata to UNS. |
| [`@uns-kit/cron`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-cron) | Cron-driven scheduler that emits UNS events on a fixed cadence. |
| [`@uns-kit/temporal`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-temporal) | Temporal.io integration that wires workflows into UnsProxyProcess. |
| [`@uns-kit/cli`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-cli) | Command line tool for scaffolding new UNS applications. |

## Prerequisites

- Node.js 18 or newer (ES2022 runtime features)
- A package manager such as `pnpm`, `npm`, or `yarn`
- `git` available on PATH (required for `configure-devops`, used to initialize new projects automatically)

## Usage

```bash
pnpm --package=@uns-kit/cli dlx uns-kit create my-uns-app
# or with npx
npx @uns-kit/cli create my-uns-app
# or after installing globally
npm install -g @uns-kit/cli
uns-kit create my-uns-app
```

The command creates a new directory, copies the starter template, and pins `@uns-kit/core` to the currently published version. After the scaffold finishes:

```bash
cd my-uns-app
pnpm install
pnpm run dev
```

When `git` is available on your PATH the scaffold also initializes a fresh repository so you can commit immediately.

## Commands

- `uns-kit create <name>` – create a new UNS project in the specified directory.
- `uns-kit configure [path] [features...]` – run multiple configure templates in sequence (`--all`, `--overwrite`).
- `uns-kit configure-templates [path] [templates...]` – copy any template directory (`--all`, `--overwrite`).
- `uns-kit configure-devops [path]` – add Azure DevOps tooling (dependencies, script, config) to an existing project.
- `uns-kit configure-vscode [path]` – copy VS Code launch/workspace files into an existing project.
- `uns-kit configure-codegen [path]` – scaffold GraphQL code generation and UNS refresh scripts.
- `uns-kit configure-api [path]` – copy UNS API examples and add `@uns-kit/api`.
- `uns-kit configure-cron [path]` – copy UNS cron examples and add `@uns-kit/cron`.
- `uns-kit configure-temporal [path]` – copy UNS Temporal examples and add `@uns-kit/temporal`.
- `uns-kit configure-python [path]` – copy Python gateway client scaffolding (no npm dependency required).
- `uns-kit help` – display usage information.

### Configure multiple features at once

Chain several add-ons without running each subcommand manually:

```bash
uns-kit configure --all
uns-kit configure ./apps/gateway devops vscode codegen
```

Mix and match feature names after an optional target directory. Use `--all` to apply every available template in one shot. Add `--overwrite` to refresh files from newer template versions.

### Copy arbitrary templates

Need a template that is not wired into a configure feature (or added in a newer release)? Use:

```bash
uns-kit configure-templates --all
uns-kit configure-templates ./apps/gateway uns-dictionary uns-measurements --overwrite
```

### Configure Azure DevOps

Run inside a scaffolded project to add the Azure DevOps pull-request tooling:

```bash
uns-kit configure-devops
pnpm install
pnpm run pull-request
```

The command prompts for your Azure DevOps organization/project, ensures the remote repository exists, and updates `config.json` along with the necessary dev dependencies.

### Configure VS Code workspace

```bash
uns-kit configure-vscode
```

Copies `.vscode/launch.json` plus a baseline workspace file into the project. Existing files are skipped unless you pass `--overwrite`.

### Configure GraphQL code generation

```bash
uns-kit configure-codegen
pnpm install
pnpm run codegen
pnpm run refresh-uns
```

Adds `codegen.ts`, seeds `src/uns/` placeholder types, and wires the GraphQL Code Generator / `refresh-uns` script into `package.json`. After installing the new dev dependencies you can regenerate strongly-typed operations (`pnpm run codegen`) and rebuild UNS topics/tags from your environment (`pnpm run refresh-uns`).
After installing the new dev dependencies you can regenerate strongly-typed operations (`pnpm run codegen`) and rebuild UNS metadata (topics/tags/assets) from your environment (`pnpm run generate-uns-metadata`).

### Add UNS API scaffolding

```bash
uns-kit configure-api
pnpm install
```

Copies API-oriented examples (under `src/examples/`) and adds `@uns-kit/api` to your project dependencies.
Use `--overwrite` to refresh the examples after updating `uns-kit`.

### Add cron-based scaffolding

```bash
uns-kit configure-cron
pnpm install
```

Adds cron-oriented example stubs and installs `@uns-kit/cron`.
Use `--overwrite` to refresh the examples after updating `uns-kit`.

### Add Temporal scaffolding

```bash
uns-kit configure-temporal
pnpm install
```

Copies Temporal example placeholders and installs `@uns-kit/temporal`.
Use `--overwrite` to refresh the examples after updating `uns-kit`.

### Add Python gateway scaffolding

```bash
uns-kit configure-python
```

Copies the Python gateway client template (examples, scripts, requirements, proto) into your project so you can iterate on the gRPC gateway from Python alongside your TypeScript project.
Use `--overwrite` to refresh the examples after updating `uns-kit`.

### Extend the Config Schema

Edit `src/config/project.config.extension.ts` inside your generated project and run `pnpm run generate-config-schema`. This regenerates `config.schema.json` and `src/config/app-config.ts`, augmenting `@uns-kit/core`'s `AppConfig` so editors and runtime types stay in sync. If completions lag, reload the TypeScript server in your editor.

## License

MIT © Aljoša Vister
