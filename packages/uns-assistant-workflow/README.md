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
- exact host-provided tool handoff selection, bound to a rebuilt invocation,
  reviewed allowlist, and application-owned argument validator;
- versioned tool-evidence envelope parsing and exact invocation/call binding,
  with application-owned data-schema validation;
- definition packages, catalog loading, replay, evaluation, and review helpers.

The package deliberately does not contain provider credentials, database access,
HTTP transport, UNS-specific tool implementations, or application-specific
workflow definitions.

## Exact Tool Handoffs

When a host has rebuilt a workflow plan and wants to delegate exactly one
reviewed read-only tool, use `selectAssistantWorkflowApprovedToolInvocation`.
It does not infer arguments from assistant text or choose among broad tool
permissions: it binds one host-provided handoff to one invocation in the rebuilt
plan and rejects ambiguous handoffs.

```ts
import { selectAssistantWorkflowApprovedToolInvocation } from "@uns-kit/assistant-workflow";

const approved = selectAssistantWorkflowApprovedToolInvocation({
  invocations: rebuiltRun.toolInvocationQueue.invocations,
  handoffs: [{
    invocationId: "fetch_document:read_document",
    toolName: "read_document",
    args: { documentId: "manual-1" },
  }],
  policies: [{
    toolName: "read_document",
    normalizeArgs: (args) =>
      typeof args.documentId === "string" && Object.keys(args).length === 1
        ? { documentId: args.documentId }
        : null,
  }],
  allowedToolNames: ["read_document"],
});

if (approved) {
  // `approved.args` passed the application-owned exact argument contract.
}
```

Tool schemas remain application-owned. The caller must pass only the exact
controller/host handoff that it already reviewed; multiple handoffs or multiple
matching policies return `null`.

## Tool Evidence

`tool-evidence` validates the generic envelope and its binding to an approved
invocation. Applications choose the format/version and own `data` validation;
the package does not interpret database rows, protocol payloads, or tool-specific
arguments.

```ts
import {
  matchesAssistantWorkflowToolEvidenceBinding,
  parseAssistantWorkflowToolEvidence,
} from "@uns-kit/assistant-workflow/tool-evidence";

const evidence = parseAssistantWorkflowToolEvidence(rawEvidence, {
  format: "example.tool-evidence",
  formatVersion: 1,
  parseData: (value) => isMyApplicationData(value) ? value : null,
});

const matches = evidence && matchesAssistantWorkflowToolEvidenceBinding(evidence, {
  invocationId: approved.invocation.id,
  toolName: approved.invocation.toolName,
  callId,
  expiresAt: delegation.expiresAt,
});
```

## Development

```bash
pnpm --filter @uns-kit/assistant-workflow run verify
pnpm --filter @uns-kit/assistant-workflow run build
```

The package is versioned with the rest of `@uns-kit/*`. Publishing is a manual
maintainer action and is not performed by package verification commands.
