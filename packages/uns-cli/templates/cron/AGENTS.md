# Agent Onboarding (template)

Pointers for AI/code-assist tools when working in this generated project.

## What to read locally

- `package.json` for scripts (`generate-uns-*`, `generate-codegen`, etc.).
- `config.schema.json` for the app config shape; `processName` is required.
- `src/examples/*.ts` for cron-driven publish patterns and description registration.
- Installed docs (under `node_modules`):
  - `@uns-kit/core/README.md`
  - `@uns-kit/api/README.md` (if installed)
  - `@uns-kit/cron/README.md` (if installed)
  - `@uns-kit/temporal/README.md` (if installed)
  - `@uns-kit/cli/README.md` (if installed)

## Generators in this project

- `pnpm run generate-uns-dictionary` -> updates `src/uns/uns-dictionary.generated.ts`
- `pnpm run generate-uns-measurements` -> updates `src/uns/uns-measurements.generated.ts`
- `pnpm run generate-uns-reference` -> runs both
- `pnpm run generate-uns-topics-tags` -> refreshes topic/tag unions (requires GraphQL connectivity)
- `pnpm run generate-codegen` -> GraphQL codegen (after configure-codegen)
