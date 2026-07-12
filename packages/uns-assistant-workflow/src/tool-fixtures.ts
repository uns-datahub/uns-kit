import type {
  AssistantWorkflowToolExecutor,
  AssistantWorkflowToolExecutorContext,
} from "./tool-executor.js";
import type { AssistantWorkflowToolInvocation } from "./tool-invocations.js";

export type AssistantWorkflowToolFixture =
  | {
    status: "success";
    output?: unknown;
  }
  | {
    status: "error";
    errorMessage: string;
  };

export type AssistantWorkflowToolFixtureInput = AssistantWorkflowToolFixture | unknown;

export type AssistantWorkflowToolFixtureMap = Record<string, AssistantWorkflowToolFixtureInput>;

export type AssistantWorkflowFixtureToolExecutorOptions = {
  defaultOutput?: unknown;
  missingFixture?: "error" | "default-output";
};

export function buildAssistantWorkflowFixtureToolExecutor(
  fixtures: AssistantWorkflowToolFixtureMap,
  options: AssistantWorkflowFixtureToolExecutorOptions = {},
): AssistantWorkflowToolExecutor {
  return (invocation, context) => executeAssistantWorkflowFixtureToolInvocation(
    fixtures,
    invocation,
    context,
    options,
  );
}

export function executeAssistantWorkflowFixtureToolInvocation(
  fixtures: AssistantWorkflowToolFixtureMap,
  invocation: AssistantWorkflowToolInvocation,
  context: AssistantWorkflowToolExecutorContext,
  options: AssistantWorkflowFixtureToolExecutorOptions = {},
): unknown {
  const fixture = findFixture(fixtures, invocation, context);
  if (fixture === undefined) {
    if (options.missingFixture === "default-output") {
      return options.defaultOutput ?? {
        invocationId: invocation.id,
        toolName: invocation.toolName,
      };
    }
    throw new Error(`No fixture output configured for ${invocation.id}.`);
  }

  const normalized = normalizeFixture(fixture);
  if (normalized.status === "error") {
    throw new Error(normalized.errorMessage);
  }
  return normalized.output;
}

function findFixture(
  fixtures: AssistantWorkflowToolFixtureMap,
  invocation: AssistantWorkflowToolInvocation,
  context: AssistantWorkflowToolExecutorContext,
): AssistantWorkflowToolFixtureInput | undefined {
  const indexKey = String(context.invocationIndex);
  return fixtures[invocation.id]
    ?? fixtures[invocation.toolName]
    ?? fixtures[indexKey];
}

function normalizeFixture(value: AssistantWorkflowToolFixtureInput): AssistantWorkflowToolFixture {
  if (isFixtureRecord(value)) {
    if (value["status"] === "error") {
      return {
        status: "error",
        errorMessage: typeof value["errorMessage"] === "string" && value["errorMessage"].trim().length
          ? value["errorMessage"].trim()
          : "fixture tool invocation failed",
      };
    }
    if (value["status"] === "success") {
      return {
        status: "success",
        ...("output" in value ? { output: value["output"] } : {}),
      };
    }
  }
  return {
    status: "success",
    output: value,
  };
}

function isFixtureRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
