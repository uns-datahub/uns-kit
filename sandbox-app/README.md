# sandbox-app

Generated with `@uns-kit/cli`.

## Scripts

```bash
pnpm run dev    # start the local development loop
pnpm run build  # emit dist/ output
pnpm run start  # run the compiled entrypoint
pnpm run generate-config-schema  # regenerate config.schema.json and AppConfig types
```

## Configuration

Update `config.json` with your broker, UNS URLs, and credentials. The generated file contains sensible defaults for local development.

## Next Steps

- Install additional plugins: `pnpm add @uns-kit/api` etc.
- Create MQTT proxies or Temporal workflows inside `src/index.ts`.
- Extend `src/config/project.config.extension.ts` with project-specific sections and run `pnpm run generate-config-schema`.
- Run `uns-kit configure-devops` to add the Azure DevOps pull-request tooling.
- Commit your new project and start building!
