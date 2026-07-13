# Agent Onboarding (template)

Pointers for AI/code-assist tools when working in this generated project.

## What to read locally

- `package.json` for scripts (`sync-uns-*`, `generate-codegen`, etc.).
- `config.schema.json` for the app config shape; `processName` is required.
- `src/examples/*.ts` for cron-driven publish patterns and description registration.
- Installed docs (under `node_modules`):
  - `@uns-kit/core/README.md`
  - `@uns-kit/core/MIGRATIONS.md`
  - `@uns-kit/api/README.md` (if installed)
  - `@uns-kit/cron/README.md` (if installed)
  - `@uns-kit/cli/README.md` (if installed)

## Generators in this project

- `pnpm run generate-codegen` -> GraphQL codegen (after configure-codegen)
- `pnpm run sync-uns-schema -- --controller-url ... --token ...` -> pulls `uns-dictionary.json` + `uns-measurements.json` from the controller and regenerates local TS helpers
- `pnpm run sync-uns-metadata -- --controller-url ... --token ...` -> pulls topics/tags/assets from the controller and regenerates local TS helpers

<!-- uns-kit:migrations:start -->
## UNS Kit dependency upgrades

- Before changing any `@uns-kit/*` version, record the installed source version and intended target version.
- After installing the target version, read `node_modules/@uns-kit/core/MIGRATIONS.md` and apply every migration whose version boundary is crossed. Do not apply unrelated migrations.
- When crossing `<2.0.71` to `>=2.0.71`, inspect MQTT proxy ownership and follow the documented shutdown migration. Process-owned and standalone proxies have different shutdown paths.
<!-- uns-kit:migrations:end -->
