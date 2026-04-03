# @uns-kit/cli

Command line scaffolding tool for the UNS toolkit. Bootstraps new projects with `@uns-kit/core` preconfigured and ready to extend with plugins. Also provides configure and upgrade commands for existing projects.

Note: Apps built with uns-kit are intended to be managed by the **UNS Datahub controller**.

## uns-kit in context

| Package | Description |
| --- | --- |
| [`@uns-kit/core`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-core) | Base runtime (UnsProxyProcess, MQTT helpers, config tooling, gRPC gateway). |
| [`@uns-kit/api`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-api) | Express plugin — HTTP endpoints, JWT/JWKS auth, Swagger, UNS metadata. |
| [`@uns-kit/cron`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-cron) | Cron-driven scheduler that emits UNS events on a fixed cadence. |
| [`@uns-kit/cli`](https://github.com/uns-datahub/uns-kit/tree/main/packages/uns-cli) | CLI for scaffolding new UNS applications. |

## Prerequisites

- Node.js 22 or newer
- `pnpm`, `npm`, or `yarn`
- `git` on PATH (used to initialise new projects and for `configure-devops`)

## Create a new project

```bash
pnpm --package=@uns-kit/cli dlx uns-kit create my-uns-app
# or with npx
npx @uns-kit/cli create my-uns-app
```

After scaffolding:

```bash
cd my-uns-app
pnpm install
pnpm run dev
```

The scaffold creates a project directory from the default TypeScript template, pins `@uns-kit/core` to the current version, and initialises a git repository if `git` is available.

### Create from a service bundle

```bash
uns-kit create --bundle ./service.bundle.json
uns-kit create --bundle ./service.bundle.json --dest ./my-dir
uns-kit create --bundle ./service.bundle.json --dest . --allow-existing
```

Bundle-driven create uses `service.bundle.json` as the source of truth. The CLI scaffolds the base app, copies the bundle into the project root, generates `SERVICE_SPEC.md` and `AGENTS.md`, and applies supported bundle features (`vscode`, `devops`, etc.). Only bundles with `scaffold.stack = "ts"` are accepted by this CLI; use `uns-kit-py` for Python bundles.

## Commands

### `uns-kit create <name>`
Scaffold a new project from the default TypeScript template.

### `uns-kit create --bundle <path> [--dest <dir>] [--allow-existing]`
Scaffold from a `service.bundle.json` descriptor.

### `uns-kit configure [dir] [features...]`
Apply one or more feature templates to an existing project in one go.

```bash
uns-kit configure                        # prompts for features
uns-kit configure --all                  # apply all available features
uns-kit configure ./my-app api cron      # add API and cron scaffolding
uns-kit configure ./my-app --overwrite   # refresh existing files from latest templates
```

Available feature names: `devops`, `vscode`, `codegen`, `api`, `cron`, `python`, `uns-reference`.

### `uns-kit configure-templates [dir] [templates...]`
Copy any template directory by name.

```bash
uns-kit configure-templates --all
uns-kit configure-templates uns-dictionary uns-measurements --overwrite
```

### `uns-kit configure-devops [dir]`
Add Azure DevOps pull-request tooling. Requires a git repository.

```bash
uns-kit configure-devops
pnpm install
pnpm run pull-request
```

### `uns-kit configure-vscode [dir]`
Copy `.vscode/launch.json` and a workspace file. Skips existing files unless `--overwrite` is passed.

### `uns-kit configure-codegen [dir]`
Scaffold GraphQL code generation (`codegen.ts`, placeholder types in `src/uns/`).

```bash
uns-kit configure-codegen
pnpm install
pnpm run generate-codegen   # regenerate strongly-typed GraphQL operations
```

### `uns-kit configure-api [dir]`
Copy API example stubs (`src/examples/api-example.ts`) and add `@uns-kit/api`.

```bash
uns-kit configure-api
pnpm install
```

The example shows both GET and POST endpoint registration with JWT auth, query params, request body schemas, and event handlers. Rename and adapt `api-example.ts` to `index.ts` as your starting point.

### `uns-kit configure-cron [dir]`
Copy cron example stubs and add `@uns-kit/cron`.

```bash
uns-kit configure-cron
pnpm install
```

### `uns-kit configure-python [dir]`
Copy Python gRPC gateway client scaffolding (no npm dependency required).

```bash
uns-kit configure-python
```

### `uns-kit configure-uns-reference [dir]`
Copy UNS dictionary and measurements JSON files into the project and add the `sync-uns-schema` script to `package.json`.

```bash
uns-kit configure-uns-reference
pnpm run sync-uns-schema   # pull latest schema from the controller
```

### `uns-kit upgrade [dir]`
Remove obsolete scripts from `package.json` and migrate to current conventions.

```bash
uns-kit upgrade           # upgrade current directory
uns-kit upgrade ./my-app  # upgrade a specific project
```

Removes scripts that have been superseded (`generate-uns-dictionary`, `generate-uns-measurements`, `generate-uns-reference`, `generate-uns-metadata`) and ensures `sync-uns-schema` is present.

### `uns-kit help`
Display usage information.

## Extend the config schema

Edit `src/config/project.config.extension.ts` inside your project and run:

```bash
pnpm run generate-config-schema
```

This regenerates `config.schema.json` and `src/config/app-config.ts` so editors and runtime types stay in sync with your extensions.

## Sync the UNS schema

After scaffolding (or at any time) pull the latest UNS dictionary and measurements from the controller:

```bash
pnpm run sync-uns-schema
```

The controller URL is read from `config.json` (`uns.rest`) automatically. You will be prompted for the bearer token if `UNS_CONTROLLER_TOKEN` is not set.

## License

MIT © Aljoša Vister
