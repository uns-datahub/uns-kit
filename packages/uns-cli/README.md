# @uns-kit/cli

Command line scaffolding tool for the UNS toolkit. It bootstraps a new project with `@uns-kit/core` preconfigured and ready to extend with additional plugins.

## Usage

```bash
pnpm dlx @uns-kit/cli create my-uns-app
# or after installing globally
yarn global add @uns-kit/cli
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
- `uns-kit help` – display usage information.

## License

MIT © Aljoša Vister
