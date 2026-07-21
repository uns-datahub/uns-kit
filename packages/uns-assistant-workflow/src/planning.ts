import {
  findAssistantWorkflowIntent,
  normalizeAssistantWorkflowId,
  type AssistantWorkflowDefinition,
  type AssistantWorkflowPlanningStepProfile,
  type AssistantWorkflowPlanningStepDefinition,
  type AssistantWorkflowPlanningStepKind,
} from "./definition.js";

export type AssistantWorkflowPlanStepTrace = {
  id: string;
  kind: AssistantWorkflowPlanningStepKind;
  optional: boolean;
  dependsOnStepIds: string[];
  toolHints: string[];
  requiredToolHints: string[];
};

export type AssistantWorkflowPlanExecutionHints = {
  needsClarification: boolean;
  needsSynthesis: boolean;
  producesArtifact: boolean;
  mayGenerate: boolean;
};

export type AssistantWorkflowPlan = {
  stepIds: string[];
  steps: AssistantWorkflowPlanStepTrace[];
  activePlanningStepProfileIds: string[];
  profileStepIds: string[];
  toolHints: string[];
  requiredToolHints: string[];
  missingToolHints: string[];
  missingRequiredToolHints: string[];
  missingPlanningSteps: string[];
  executionHints: AssistantWorkflowPlanExecutionHints;
};

export type AssistantWorkflowPlanContext = {
  subintent?: string | null;
  presentation?: string | null;
  timeWindowHint?: string | null;
  toolsToExpose?: readonly string[] | null;
  confidence?: number | null;
};

export function findAssistantWorkflowPlanningStep(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
  stepId: unknown,
): AssistantWorkflowPlanningStepDefinition | null {
  const normalized = normalizeAssistantWorkflowId(stepId);
  if (!normalized) return null;
  return (workflow.planningSteps ?? []).find((step) => step.id === normalized) ?? null;
}

export function buildAssistantWorkflowPlan(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
  intentId: unknown,
  availableToolNames: readonly string[] = [],
  context: AssistantWorkflowPlanContext = {},
): AssistantWorkflowPlan {
  const intent = findAssistantWorkflowIntent(workflow, intentId);
  const stepsById = new Map((workflow.planningSteps ?? []).map((step) => [step.id, step] as const));
  const availableSet = new Set(availableToolNames);
  const steps: AssistantWorkflowPlanningStepDefinition[] = [];
  const missingPlanningSteps: string[] = [];
  const activePlanningStepProfileIds: string[] = [];
  const profileStepIds: string[] = [];
  const seen = new Set<string>();
  const baseStepIds = [...(intent?.planningSteps ?? [])];
  const conditionalStepIds = collectProfilePlanningStepIds(
    intent?.planningStepProfiles ?? [],
    context,
    activePlanningStepProfileIds,
  );
  const orderedStepIds = insertConditionalStepsBeforeSynthesis(baseStepIds, conditionalStepIds, stepsById);

  for (const rawStepId of orderedStepIds) {
    const stepId = normalizeAssistantWorkflowId(rawStepId);
    if (!stepId || seen.has(stepId)) continue;
    seen.add(stepId);
    const step = stepsById.get(stepId);
    if (step) {
      steps.push(step);
      if (!profileStepIds.includes(stepId) && activePlanningStepProfileIds.length > 0) {
        const fromProfile = (intent?.planningStepProfiles ?? [])
          .filter((profile) => activePlanningStepProfileIds.includes(profile.id))
          .some((profile) => profile.planningSteps.includes(stepId));
        if (fromProfile && !baseStepIds.includes(stepId)) {
          profileStepIds.push(stepId);
        }
      }
    } else {
      missingPlanningSteps.push(stepId);
    }
  }

  const rawToolHints = uniqueStrings(steps.flatMap((step) => step.toolHints ?? []));
  const rawRequiredToolHints = uniqueStrings(steps.flatMap((step) => step.requiredToolHints ?? []));
  const toolHints = filterToolNames(rawToolHints, availableSet);
  const requiredToolHints = filterToolNames(rawRequiredToolHints, availableSet);

  return {
    stepIds: steps.map((step) => step.id),
    steps: steps.map((step) => ({
      id: step.id,
      kind: step.kind,
      optional: step.optional === true,
      dependsOnStepIds: uniqueStrings(step.dependsOn ?? []),
      toolHints: filterToolNames(step.toolHints ?? [], availableSet),
      requiredToolHints: filterToolNames(step.requiredToolHints ?? [], availableSet),
    })),
    activePlanningStepProfileIds,
    profileStepIds,
    toolHints,
    requiredToolHints,
    missingToolHints: availableSet.size === 0 ? [] : rawToolHints.filter((tool) => !availableSet.has(tool)),
    missingRequiredToolHints:
      availableSet.size === 0 ? [] : rawRequiredToolHints.filter((tool) => !availableSet.has(tool)),
    missingPlanningSteps,
    executionHints: {
      needsClarification: steps.some((step) => step.kind === "ask_clarification"),
      needsSynthesis: steps.some((step) => step.kind === "synthesize"),
      producesArtifact: steps.some((step) => step.kind === "build_artifact" || step.kind === "generate"),
      mayGenerate: steps.some((step) => step.kind === "generate"),
    },
  };
}

function insertConditionalStepsBeforeSynthesis(
  baseStepIds: readonly string[],
  conditionalStepIds: readonly string[],
  stepsById: ReadonlyMap<string, AssistantWorkflowPlanningStepDefinition>,
): string[] {
  if (!conditionalStepIds.length) return [...baseStepIds];
  const insertIndex = baseStepIds.findIndex((rawStepId) => {
    const stepId = normalizeAssistantWorkflowId(rawStepId);
    const kind = stepId ? stepsById.get(stepId)?.kind : null;
    return kind === "build_artifact" || kind === "generate" || kind === "synthesize";
  });
  if (insertIndex < 0) return [...baseStepIds, ...conditionalStepIds];
  return [
    ...baseStepIds.slice(0, insertIndex),
    ...conditionalStepIds,
    ...baseStepIds.slice(insertIndex),
  ];
}

function collectProfilePlanningStepIds(
  profiles: readonly AssistantWorkflowPlanningStepProfile[],
  context: AssistantWorkflowPlanContext,
  activeProfileIds: string[],
): string[] {
  const out: string[] = [];
  for (const profile of profiles) {
    if (!matchesPlanningStepProfile(profile, context)) continue;
    activeProfileIds.push(profile.id);
    out.push(...profile.planningSteps);
  }
  return out;
}

function matchesPlanningStepProfile(
  profile: AssistantWorkflowPlanningStepProfile,
  context: AssistantWorkflowPlanContext,
): boolean {
  const condition = profile.condition;
  if (!condition) return true;
  if (condition.subintent !== undefined && normalizeAssistantWorkflowId(context.subintent) !== condition.subintent) {
    return false;
  }
  if (condition.presentation !== undefined && normalizeAssistantWorkflowId(context.presentation) !== condition.presentation) {
    return false;
  }
  if (condition.timeWindowHint !== undefined && normalizeAssistantWorkflowId(context.timeWindowHint) !== condition.timeWindowHint) {
    return false;
  }
  if (condition.minConfidence !== undefined) {
    if (typeof context.confidence !== "number" || context.confidence < condition.minConfidence) return false;
  }
  if (condition.maxConfidence !== undefined) {
    if (typeof context.confidence !== "number" || context.confidence > condition.maxConfidence) return false;
  }
  const requiredTools = condition.requiredTools ?? [];
  if (requiredTools.length > 0) {
    const tools = new Set(uniqueStrings(context.toolsToExpose ?? []));
    if (!requiredTools.every((tool) => tools.has(tool))) return false;
  }
  return true;
}

function filterToolNames(rawTools: readonly string[], availableSet: ReadonlySet<string>): string[] {
  if (availableSet.size === 0) return uniqueStrings(rawTools);
  return uniqueStrings(rawTools).filter((tool) => availableSet.has(tool));
}

function uniqueStrings(values: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = normalizeAssistantWorkflowId(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}
