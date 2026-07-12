import {
  buildAssistantWorkflowDefinitionPackageResolveTracePayload,
  resolveAssistantWorkflowDefinitionFromPackage,
  type AssistantWorkflowDefinitionPackageResolveOptions,
  type AssistantWorkflowDefinitionPackageResolveResult,
} from "./definition-package-resolver.js";
import {
  buildAssistantWorkflowRun,
  buildAssistantWorkflowRunTracePayload,
  type AssistantWorkflowRun,
  type AssistantWorkflowRunInput,
} from "./run.js";

export type AssistantWorkflowDefinitionPackageRunInput =
  AssistantWorkflowDefinitionPackageResolveOptions &
  AssistantWorkflowRunInput;

export type AssistantWorkflowDefinitionPackageRunStatus =
  | "run_built"
  | "resolve_failed";

export type AssistantWorkflowDefinitionPackageRunResult =
  | {
    built: true;
    status: "run_built";
    resolve: AssistantWorkflowDefinitionPackageResolveResult;
    run: AssistantWorkflowRun;
    reason: string | null;
  }
  | {
    built: false;
    status: "resolve_failed";
    resolve: AssistantWorkflowDefinitionPackageResolveResult;
    run: null;
    reason: string;
  };

export function buildAssistantWorkflowRunFromPackage(
  value: unknown,
  input: AssistantWorkflowDefinitionPackageRunInput = {},
): AssistantWorkflowDefinitionPackageRunResult {
  const resolve = resolveAssistantWorkflowDefinitionFromPackage(value, {
    ...(input.allowBlocked !== undefined ? { allowBlocked: input.allowBlocked } : {}),
    ...(input.workflowId !== undefined ? { workflowId: input.workflowId } : {}),
    ...(input.version !== undefined ? { version: input.version } : {}),
    ...(input.includeInvalid !== undefined ? { includeInvalid: input.includeInvalid } : {}),
  });

  if (!resolve.resolved) {
    return {
      built: false,
      status: "resolve_failed",
      resolve,
      run: null,
      reason: resolve.reason,
    };
  }

  const run = buildAssistantWorkflowRun(resolve.definition.definition, {
    ...(input.classification !== undefined ? { classification: input.classification } : {}),
    ...(input.availableToolNames !== undefined ? { availableToolNames: input.availableToolNames } : {}),
    ...(input.availableContext !== undefined ? { availableContext: input.availableContext } : {}),
  });

  return {
    built: true,
    status: "run_built",
    resolve,
    run,
    reason: null,
  };
}

export function buildAssistantWorkflowDefinitionPackageRunTracePayload(
  result: AssistantWorkflowDefinitionPackageRunResult,
): Record<string, unknown> {
  return {
    built: result.built,
    status: result.status,
    reason: result.reason,
    resolve: buildAssistantWorkflowDefinitionPackageResolveTracePayload(result.resolve),
    run: result.run ? buildAssistantWorkflowRunTracePayload(result.run) : null,
  };
}
