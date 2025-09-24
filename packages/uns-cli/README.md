# @uns-kit/cli

Command line scaffolding tool for the UNS toolkit. It bootstraps a new project with `@uns-kit/core` preconfigured and ready to extend with additional plugins.

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

## Commands

- `uns-kit create <name>` – create a new UNS project in the specified directory.
- `uns-kit configure-devops [path]` – add Azure DevOps tooling (dependencies, script, config) to an existing project.
- `uns-kit configure-vscode [path]` – copy VS Code launch/workspace files into an existing project.
- `uns-kit configure-codegen [path]` – scaffold GraphQL code generation and UNS refresh scripts.
- `uns-kit help` – display usage information.

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

Copies `.vscode/launch.json` plus a baseline workspace file into the project. Existing files are never overwritten, making it safe to re-run after hand edits.

### Configure GraphQL code generation

```bash
uns-kit configure-codegen
pnpm install
pnpm run codegen
pnpm run refresh-uns
```

Adds `codegen.ts`, seeds `src/uns/` placeholder types, and wires the GraphQL Code Generator / `refresh-uns` script into `package.json`. After installing the new dev dependencies you can regenerate strongly-typed operations (`pnpm run codegen`) and rebuild UNS topics/tags from your environment (`pnpm run refresh-uns`).

### Extend the Config Schema

Edit `src/config/project.config.extension.ts` inside your generated project and run `pnpm run generate-config-schema`. This regenerates `config.schema.json` and `src/config/app-config.ts` so editors and runtime types stay in sync.

## License

MIT © Aljoša Vister
