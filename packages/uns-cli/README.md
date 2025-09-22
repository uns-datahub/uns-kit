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
- `uns-kit help` – display usage information.

### Configure Azure DevOps

Run inside a scaffolded project to add the Azure DevOps pull-request tooling:

```bash
uns-kit configure-devops
pnpm install
pnpm run pull-request
```

The command prompts for your Azure DevOps organization and updates `config.json` along with the necessary dev dependencies.

## License

MIT © Aljoša Vister
