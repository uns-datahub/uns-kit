# @uns-kit/assistant-workflow

Provider-neutral TypeScript primitives for defining, evaluating, executing, and
reviewing assistant workflows.

The package defines workflow vocabulary and policy. Applications retain
ownership of authentication, persistence, concrete tool handlers, provider SDKs,
and user-facing responses.

## Install

```bash
pnpm add @uns-kit/assistant-workflow
```

## Scope

- typed workflow, intent, planning-step, memory, and clarification definitions;
- tool capability and binding contracts for local functions, HTTP, hosted tools,
  MCP, and controlled REPL integrations;
- deterministic plan/run construction, execution queues, parity checks, and
  safe trace/report serialization;
- definition packages, catalog loading, replay, evaluation, and review helpers.

The package deliberately does not contain provider credentials, database access,
HTTP transport, UNS-specific tool implementations, or application-specific
workflow definitions.

## Development

```bash
pnpm --filter @uns-kit/assistant-workflow run verify
pnpm --filter @uns-kit/assistant-workflow run build
```

The package is versioned with the rest of `@uns-kit/*`. Publishing is a manual
maintainer action and is not performed by package verification commands.
