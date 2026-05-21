# Agent Onboarding (template)

Pointers for AI/code-assist tools when working in this generated project.

## What to read locally

- `package.json` for scripts (`sync-uns-*`, `generate-codegen`, etc.).
- `config.schema.json` for the app config shape; `processName` is required.
- `src/examples/*.ts` for idiomatic publishing (multi-attribute) and description registration.
- Installed docs (under `node_modules`):
  - `@uns-kit/core/README.md`
  - `@uns-kit/api/README.md` (if installed)
  - `@uns-kit/cron/README.md` (if installed)
  - `@uns-kit/cli/README.md` (if installed)

## Generators in this project

- `pnpm run generate-codegen` -> GraphQL codegen (after configure-codegen)
- `pnpm run sync-uns-schema -- --controller-url ... --token ...` -> pulls `uns-dictionary.json` + `uns-measurements.json` from the controller and regenerates local TS helpers
- `pnpm run sync-uns-metadata -- --controller-url ... --token ...` -> pulls topics/tags/assets from the controller and regenerates local TS helpers
