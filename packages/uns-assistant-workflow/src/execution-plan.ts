import type { AssistantWorkflowDecision } from "./decision.js";
import {
  type AssistantWorkflowDefinition,
  type AssistantWorkflowPlanningStepKind,
  type AssistantWorkflowToolContextRequirement,
} from "./definition.js";
import {
  resolveAssistantWorkflowTools,
  type AssistantWorkflowToolResolution,
} from "./tool-bindings.js";
import {
  buildAssistantWorkflowExecutionBudgetAssessment,
  buildAssistantWorkflowExecutionBudgetTracePayload,
  formatAssistantWorkflowExecutionBudgetViolation,
  type AssistantWorkflowExecutionBudget,
  type AssistantWorkflowExecutionBudgetAssessment,
} from "./execution-budget.js";
import {
  resolveAssistantWorkflowExecutionPolicy,
  type AssistantWorkflowExecutionPolicy,
} from "./execution-policy.js";

export type AssistantWorkflowExecutionPlanStatus =
  | "ready"
  | "needs-clarification"
  | "blocked"
  | "partial";

export type AssistantWorkflowExecutionStepStatus =
  | "ready"
  | "blocked"
  | "optional-skipped"
  | "partial";

export type AssistantWorkflowExecutionStep = {
  id: string;
  kind: AssistantWorkflowPlanningStepKind;
  optional: boolean;
  dependsOnStepIds: string[];
  missingDependencyStepIds: string[];
  outOfOrderDependencyStepIds: string[];
  status: AssistantWorkflowExecutionStepStatus;
  toolNames: string[];
  requiredToolNames: string[];
  readyToolNames: string[];
  missingCapabilityNames: string[];
  missingBindingNames: string[];
  providerMismatchNames: string[];
  requiredContext: AssistantWorkflowToolContextRequirement[];
  missingContextRequirements: AssistantWorkflowToolContextRequirement[];
  blockingReasons: string[];
  warnings: string[];
};

export type AssistantWorkflowExecutionPlan = {
  intent: string | null;
  status: AssistantWorkflowExecutionPlanStatus;
  steps: AssistantWorkflowExecutionStep[];
  readyToolNames: string[];
  requiredReadyToolNames: string[];
  missingCapabilityNames: string[];
  missingBindingNames: string[];
  providerMismatchNames: string[];
  requiredContext: AssistantWorkflowToolContextRequirement[];
  missingContextRequirements: AssistantWorkflowToolContextRequirement[];
  missingPlanningSteps: string[];
  clarificationRuleIds: string[];
  blockingReasons: string[];
  warnings: string[];
  executionHints: AssistantWorkflowDecision["plan"]["executionHints"];
  executionBudget?: AssistantWorkflowExecutionBudget | null;
  budgetAssessment?: AssistantWorkflowExecutionBudgetAssessment | null;
  executionPolicy?: AssistantWorkflowExecutionPolicy;
};

export type AssistantWorkflowExecutionPlanOptions = {
  availableContext?: readonly AssistantWorkflowToolContextRequirement[] | null;
};

export function buildAssistantWorkflowExecutionPlan(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
  decision: AssistantWorkflowDecision,
  options: AssistantWorkflowExecutionPlanOptions = {},
): AssistantWorkflowExecutionPlan {
  const availableContext = options.availableContext ? new Set(options.availableContext) : null;
  const selectedStepIds = new Set(decision.plan.steps.map((step) => step.id));
  const seenStepIds = new Set<string>();
  const steps = decision.plan.steps.map((step) => {
    const missingDependencyStepIds = step.dependsOnStepIds.filter((stepId) => !selectedStepIds.has(stepId));
    const outOfOrderDependencyStepIds = step.dependsOnStepIds.filter(
      (stepId) => selectedStepIds.has(stepId) && !seenStepIds.has(stepId),
    );
    const requiredToolNames = uniqueStrings(step.requiredToolHints);
    const optionalToolNames = uniqueStrings(step.toolHints).filter((tool) => !requiredToolNames.includes(tool));
    const toolNames = uniqueStrings([...requiredToolNames, ...optionalToolNames]);
    const requiredResolution = resolveAssistantWorkflowTools(workflow, requiredToolNames);
    const optionalResolution = resolveAssistantWorkflowTools(workflow, optionalToolNames);
    const allResolutions = [...requiredResolution.resolutions, ...optionalResolution.resolutions];
    const requiredNonReady = requiredResolution.resolutions.filter((resolution) => resolution.status !== "ready");
    const optionalNonReady = optionalResolution.resolutions.filter((resolution) => resolution.status !== "ready");
    const requiredContextGaps = getContextGaps(requiredResolution.resolutions, availableContext);
    const optionalContextGaps = getContextGaps(optionalResolution.resolutions, availableContext);
    const contextBlockingReasons = step.optional
      ? []
      : buildContextBlockingReasons(step.id, requiredContextGaps);
    const dependencyReasons = buildDependencyReasons(
      step.id,
      missingDependencyStepIds,
      outOfOrderDependencyStepIds,
    );
    const blockingReasons = step.optional
      ? []
      : [
          ...buildToolBlockingReasons(step.id, requiredNonReady),
          ...contextBlockingReasons,
          ...dependencyReasons,
        ];
    const warnings = [
      ...buildToolWarnings(step.id, step.optional ? requiredNonReady : []),
      ...buildToolWarnings(step.id, optionalNonReady),
      ...buildContextWarnings(step.id, step.optional ? requiredContextGaps : []),
      ...buildContextWarnings(step.id, optionalContextGaps),
      ...(step.optional ? dependencyReasons : []),
    ];
    const status: AssistantWorkflowExecutionStepStatus =
      step.optional && (requiredNonReady.length > 0 || requiredContextGaps.length > 0)
        ? "optional-skipped"
        : blockingReasons.length > 0
        ? "blocked"
        : optionalNonReady.length > 0 || optionalContextGaps.length > 0
        ? "partial"
        : "ready";
    const allContextGaps = [...requiredContextGaps, ...optionalContextGaps];

    const result: AssistantWorkflowExecutionStep = {
      id: step.id,
      kind: step.kind,
      optional: step.optional,
      dependsOnStepIds: [...step.dependsOnStepIds],
      missingDependencyStepIds,
      outOfOrderDependencyStepIds,
      status,
      toolNames,
      requiredToolNames,
      readyToolNames: uniqueStrings(allResolutions
        .filter((resolution) => resolution.status === "ready" && getMissingContextRequirements(resolution, availableContext).length === 0)
        .map((resolution) => resolution.toolName)),
      missingCapabilityNames: getResolutionNames(allResolutions, "missing-capability"),
      missingBindingNames: getResolutionNames(allResolutions, "missing-binding"),
      providerMismatchNames: getResolutionNames(allResolutions, "provider-mismatch"),
      requiredContext: uniqueContextRequirements(allResolutions.flatMap((resolution) => resolution.capability?.requiredContext ?? [])),
      missingContextRequirements: uniqueContextRequirements(allContextGaps.flatMap((gap) => gap.missingContextRequirements)),
      blockingReasons,
      warnings,
    };
    seenStepIds.add(step.id);
    return result;
  });

  const requiredResolution = resolveAssistantWorkflowTools(workflow, decision.requiredToolHints);
  const requiredContextGaps = getContextGaps(requiredResolution.resolutions, availableContext);
  const executionPolicy = resolveAssistantWorkflowExecutionPolicy(workflow.executionPolicy);
  const budgetAssessment = workflow.executionBudget
    ? buildAssistantWorkflowExecutionBudgetAssessment(workflow.executionBudget, {
        planningStepCount: steps.length,
        toolCallCount: getMaximumPlannedToolCalls(workflow, steps, executionPolicy),
      })
    : null;
  const blockingReasons = [
    ...decision.clarificationPolicy.blockingRuleIds.map((ruleId) => `clarification required: ${ruleId}`),
    ...decision.plan.missingPlanningSteps.map((stepId) => `missing planning step: ${stepId}`),
    ...decision.missingRequiredToolHints.map((toolName) => `required tool is unavailable: ${toolName}`),
    ...buildToolBlockingReasons("workflow", requiredResolution.resolutions.filter((resolution) => resolution.status !== "ready")),
    ...buildContextBlockingReasons("workflow", requiredContextGaps),
    ...steps.flatMap((step) => step.blockingReasons),
    ...(budgetAssessment?.violations.map(formatAssistantWorkflowExecutionBudgetViolation) ?? []),
  ];
  const warnings = uniqueStrings([
    ...decision.missingToolHints.map((toolName) => `optional tool is unavailable: ${toolName}`),
    ...steps.flatMap((step) => step.warnings),
  ]);
  const allStepTools = steps.flatMap((step) => step.toolNames);
  const allResolution = resolveAssistantWorkflowTools(workflow, allStepTools);
  const allContextGaps = getContextGaps(allResolution.resolutions, availableContext);
  const status: AssistantWorkflowExecutionPlanStatus =
    decision.clarificationPolicy.needsClarification
      ? "needs-clarification"
      : blockingReasons.length > 0
      ? "blocked"
      : warnings.length > 0 || steps.some((step) => step.status === "partial" || step.status === "optional-skipped")
      ? "partial"
      : "ready";

  return {
    intent: decision.intent,
    status,
    steps,
    readyToolNames: uniqueStrings(allResolution.resolutions
      .filter((resolution) => resolution.status === "ready" && getMissingContextRequirements(resolution, availableContext).length === 0)
      .map((resolution) => resolution.toolName)),
    requiredReadyToolNames: uniqueStrings(requiredResolution.resolutions
      .filter((resolution) => resolution.status === "ready" && getMissingContextRequirements(resolution, availableContext).length === 0)
      .map((resolution) => resolution.toolName)),
    missingCapabilityNames: uniqueStrings([
      ...allResolution.missingCapabilityNames,
      ...requiredResolution.missingCapabilityNames,
    ]),
    missingBindingNames: uniqueStrings([
      ...allResolution.missingBindingNames,
      ...requiredResolution.missingBindingNames,
    ]),
    providerMismatchNames: uniqueStrings([
      ...allResolution.providerMismatchNames,
      ...requiredResolution.providerMismatchNames,
    ]),
    requiredContext: uniqueContextRequirements(allResolution.resolutions.flatMap((resolution) => resolution.capability?.requiredContext ?? [])),
    missingContextRequirements: uniqueContextRequirements([
      ...allContextGaps.flatMap((gap) => gap.missingContextRequirements),
      ...requiredContextGaps.flatMap((gap) => gap.missingContextRequirements),
    ]),
    missingPlanningSteps: [...decision.plan.missingPlanningSteps],
    clarificationRuleIds: [...decision.clarificationPolicy.blockingRuleIds],
    blockingReasons: uniqueStrings(blockingReasons),
    warnings,
    executionHints: decision.plan.executionHints,
    executionBudget: workflow.executionBudget ? { ...workflow.executionBudget } : null,
    budgetAssessment,
    executionPolicy,
  };
}

function buildDependencyReasons(
  stepId: string,
  missingDependencyStepIds: readonly string[],
  outOfOrderDependencyStepIds: readonly string[],
): string[] {
  return [
    ...missingDependencyStepIds.map((dependencyId) => `${stepId} missing dependency step: ${dependencyId}`),
    ...outOfOrderDependencyStepIds.map((dependencyId) => `${stepId} dependency must run first: ${dependencyId}`),
  ];
}

export function buildAssistantWorkflowExecutionPlanTracePayload(
  plan: AssistantWorkflowExecutionPlan,
): Record<string, unknown> {
  return {
    intent: plan.intent,
    status: plan.status,
    steps: plan.steps,
    readyToolNames: plan.readyToolNames,
    requiredReadyToolNames: plan.requiredReadyToolNames,
    missingCapabilityNames: plan.missingCapabilityNames,
    missingBindingNames: plan.missingBindingNames,
    providerMismatchNames: plan.providerMismatchNames,
    requiredContext: plan.requiredContext,
    missingContextRequirements: plan.missingContextRequirements,
    missingPlanningSteps: plan.missingPlanningSteps,
    clarificationRuleIds: plan.clarificationRuleIds,
    blockingReasons: plan.blockingReasons,
    warnings: plan.warnings,
    executionHints: plan.executionHints,
    executionBudget: plan.executionBudget ?? null,
    budgetAssessment: plan.budgetAssessment
      ? buildAssistantWorkflowExecutionBudgetTracePayload(plan.budgetAssessment)
      : null,
    executionPolicy: plan.executionPolicy ?? resolveAssistantWorkflowExecutionPolicy(),
  };
}

function getMaximumPlannedToolCalls(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
  steps: readonly AssistantWorkflowExecutionStep[],
  policy: AssistantWorkflowExecutionPolicy,
): number {
  const capabilities = new Map((workflow.tools ?? []).map((tool) => [tool.name, tool] as const));
  return steps
    .filter((step) => step.status !== "blocked" && step.status !== "optional-skipped")
    .flatMap((step) => step.readyToolNames)
    .reduce((count, toolName) => {
      const retryClass = capabilities.get(toolName)?.retryClass;
      return count + (retryClass === "never" ? 1 : policy.maxAttemptsPerTool);
    }, 0);
}

function buildToolBlockingReasons(stepId: string, resolutions: readonly AssistantWorkflowToolResolution[]): string[] {
  return resolutions.map((resolution) => `${stepId} required tool ${resolution.toolName} is ${resolution.status}`);
}

function buildToolWarnings(stepId: string, resolutions: readonly AssistantWorkflowToolResolution[]): string[] {
  return resolutions.map((resolution) => `${stepId} optional tool ${resolution.toolName} is ${resolution.status}`);
}

type ToolContextGap = {
  toolName: string;
  missingContextRequirements: AssistantWorkflowToolContextRequirement[];
};

function getContextGaps(
  resolutions: readonly AssistantWorkflowToolResolution[],
  availableContext: ReadonlySet<AssistantWorkflowToolContextRequirement> | null,
): ToolContextGap[] {
  return resolutions
    .map((resolution) => ({
      toolName: resolution.toolName,
      missingContextRequirements: getMissingContextRequirements(resolution, availableContext),
    }))
    .filter((gap) => gap.missingContextRequirements.length > 0);
}

function getMissingContextRequirements(
  resolution: AssistantWorkflowToolResolution,
  availableContext: ReadonlySet<AssistantWorkflowToolContextRequirement> | null,
): AssistantWorkflowToolContextRequirement[] {
  if (!availableContext || resolution.status !== "ready") return [];
  return uniqueContextRequirements(resolution.capability?.requiredContext ?? [])
    .filter((requirement) => !availableContext.has(requirement));
}

function buildContextBlockingReasons(stepId: string, gaps: readonly ToolContextGap[]): string[] {
  return gaps.map((gap) =>
    `${stepId} required tool ${gap.toolName} missing context: ${gap.missingContextRequirements.join(", ")}`,
  );
}

function buildContextWarnings(stepId: string, gaps: readonly ToolContextGap[]): string[] {
  return gaps.map((gap) =>
    `${stepId} optional tool ${gap.toolName} missing context: ${gap.missingContextRequirements.join(", ")}`,
  );
}

function getResolutionNames(
  resolutions: readonly AssistantWorkflowToolResolution[],
  status: AssistantWorkflowToolResolution["status"],
): string[] {
  return uniqueStrings(
    resolutions
      .filter((resolution) => resolution.status === status)
      .map((resolution) => resolution.toolName),
  );
}

function uniqueStrings(values: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function uniqueContextRequirements(
  values: readonly AssistantWorkflowToolContextRequirement[],
): AssistantWorkflowToolContextRequirement[] {
  const out: AssistantWorkflowToolContextRequirement[] = [];
  const seen = new Set<AssistantWorkflowToolContextRequirement>();
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}
