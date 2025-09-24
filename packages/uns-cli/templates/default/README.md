# __APP_NAME__

Generated with `@uns-kit/cli`.

## Scripts

```bash
pnpm run dev    # start the local development loop
pnpm run build  # emit dist/ output
pnpm run start  # run the compiled entrypoint
pnpm run generate-config-schema  # regenerate config.schema.json and AppConfig types
pnpm run codegen            # regenerate typed GraphQL operations (after configure-codegen)
pnpm run refresh-uns        # rebuild UNS topics/tags from the live schema
```

## Configuration

Update `config.json` with your broker, UNS URLs, and credentials. The generated file contains sensible defaults for local development.

## Next Steps

- Install additional plugins: `pnpm add @uns-kit/api` etc.
- Create MQTT proxies or Temporal workflows inside `src/index.ts`.
- Extend `src/config/project.config.extension.ts` with project-specific sections and run `pnpm run generate-config-schema`.
- Run `uns-kit configure-devops` to add the Azure DevOps pull-request tooling.
- Run `uns-kit configure-vscode` to copy workspace/launch configuration for VS Code.
- Run `uns-kit configure-codegen` to scaffold GraphQL code generation and UNS refresh scripts.
- Run `uns-kit configure-api` / `configure-cron` / `configure-temporal` to pull in example stubs and install the matching UNS plugins.
- Commit your new project and start building!
