# __APP_NAME__

Generated with `@uns-kit/cli`.

Requires Node.js 22+ and pnpm (see `packageManager` in package.json).

## Scripts

```bash
pnpm run dev    # start the local development loop
pnpm run build  # emit dist/ output
pnpm run start  # run the compiled entrypoint
pnpm run generate-config-schema  # regenerate config.schema.json and AppConfig augmentations
pnpm run codegen            # regenerate typed GraphQL operations (after configure-codegen)
pnpm run generate-uns-topics-tags  # rebuild UNS topics/tags from the live schema
pnpm run generate-uns-dictionary  # generate typed object/attribute dictionary from uns-dictionary.json
pnpm run generate-uns-measurements  # generate typed measurement units from uns-measurements.json
pnpm run generate-uns-reference    # run both dictionary + measurements generators
```

## Configuration

Update `config.json` with your broker, UNS URLs, and credentials. The generated file contains sensible defaults for local development.

## Next Steps

- Install additional plugins: `pnpm add @uns-kit/api` etc.
- Create MQTT proxies or Temporal workflows inside `src/index.ts`.
- Extend `src/config/project.config.extension.ts` with project-specific sections and run `pnpm run generate-config-schema` (reload your editor's TS server afterward if completions lag).
- Run `uns-kit configure-devops` to add the Azure DevOps pull-request tooling.
- Run `uns-kit configure-vscode` to copy workspace/launch configuration for VS Code.
- Run `uns-kit configure-codegen` to scaffold GraphQL code generation and UNS refresh scripts.
- Edit `uns-dictionary.json` (object types/attributes + descriptions) and run `pnpm run generate-uns-dictionary` to emit `src/uns/uns-dictionary.generated.ts` for IDE hints/metadata; publish calls will automatically fall back to these descriptions when you omit them.
- Edit `uns-measurements.json` (units + descriptions) and run `pnpm run generate-uns-measurements` to emit `src/uns/uns-measurements.generated.ts` and feed measurement unit IntelliSense.
- Run `uns-kit configure-api` / `configure-cron` / `configure-temporal` to pull in example stubs and install the matching UNS plugins.
- Run `uns-kit configure-python` to copy the Python gateway client template (examples, scripts, proto).
- Commit your new project and start building!
