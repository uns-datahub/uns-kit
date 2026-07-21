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

## Execution Budgets

Workflow definitions may declare an optional `executionBudget`. The compiler
uses it to reject oversized plans before producing executable invocations, and
the tool executor checks it again before and between calls. Definitions without
the field preserve the existing unbounded behavior for backward compatibility.

`maxProviderCalls` and `maxEvidenceBytes` are host-level limits: generic budget
assessments represent them, while the integrating runtime supplies their live
usage. The generic tool executor directly enforces tool-call and duration
limits; it does not interrupt an already-started external call.

Definitions may also declare an `executionPolicy` and planning-step `dependsOn`
edges. Dependency cycles are invalid. The default remains one attempt with
fail-fast execution, preserving prior behavior when no policy is declared.
