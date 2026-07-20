# API Stability

`@uns-kit/assistant-workflow` treats the package root and every declared
`package.json` subpath as public API. Existing exports remain supported for the
current major version.

New source modules are internal by default. A module becomes public only when a
reviewed change adds it to both `src/index.ts` and the package `exports` map,
with consumer-oriented tests and documentation.

## Compatibility Rules

- Additive types, helpers, and optional fields may ship in a minor release.
- Behavior changes require replay coverage and a migration note.
- Deprecated exports remain available for the rest of the current major line.
- Removing or narrowing an export requires a major release.
- Experimental APIs use an explicit `experimental` subpath and make no silent
  transition into the stable root API.

Before publishing, run `pnpm --filter @uns-kit/assistant-workflow run verify`.
Consumer repositories must also typecheck and test against the packed package
before a major-version rollout is considered complete.
