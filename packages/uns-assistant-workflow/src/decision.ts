import {
  buildAssistantWorkflowClarificationPolicy,
  type AssistantWorkflowResolvedClarificationPolicy,
  type AssistantWorkflowClarificationPolicyInput,
} from "./clarification-policy.js";
import {
  findAssistantWorkflowIntent,
  type AssistantWorkflowDefinition,
  type AssistantWorkflowExecutionBias,
  type AssistantWorkflowFirstHopToolPolicy,
  type AssistantWorkflowMemoryUse,
} from "./definition.js";
import {
  buildAssistantWorkflowMemoryPolicy,
  type AssistantWorkflowResolvedMemoryPolicy,
} from "./memory-policy.js";
import {
  buildAssistantWorkflowPlan,
  type AssistantWorkflowPlan,
} from "./planning.js";

export type AssistantWorkflowDecisionInput = {
  intent?: string | null;
  subintent?: string | null;
  presentation?: string | null;
  toolsToExpose?: readonly string[] | null;
  confidence?: number | null;
  resolvedScope?: boolean;
  entities?: AssistantWorkflowClarificationPolicyInput["entities"];
  timeWindowHint?: string | null;
};

export type AssistantWorkflowDecision = {
  intent: string | null;
  matchedIntent: boolean;
  defaultPresentation: string | null;
  effectivePresentation: string | null;
  executionBias: AssistantWorkflowExecutionBias | null;
  firstHopToolPolicy: AssistantWorkflowFirstHopToolPolicy | null;
  memoryUse: AssistantWorkflowMemoryUse[];
  memoryPolicy: AssistantWorkflowResolvedMemoryPolicy;
  clarificationPolicy: AssistantWorkflowResolvedClarificationPolicy;
  plan: AssistantWorkflowPlan;
  requiredToolHints: string[];
  missingRequiredToolHints: string[];
  toolHints: string[];
  missingToolHints: string[];
  classifierTools: string[];
  workflowSuggestedTools: string[];
  extraClassifierTools: string[];
};

export function buildAssistantWorkflowDecision(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
  classification: AssistantWorkflowDecisionInput | null | undefined,
  availableToolNames: readonly string[] = [],
): AssistantWorkflowDecision {
  const intent = typeof classification?.intent === "string" && classification.intent.trim().length
    ? classification.intent.trim().toLowerCase()
    : null;
  const intentDefinition = intent ? findAssistantWorkflowIntent(workflow, intent) : null;
  const availableSet = new Set(availableToolNames);
  const classifierTools = uniqueNonEmptyStrings(classification?.toolsToExpose ?? [])
    .filter((tool) => availableSet.size === 0 || availableSet.has(tool));
  const toolHintsRaw = uniqueNonEmptyStrings(intentDefinition?.toolHints ?? []);
  const requiredToolHintsRaw = uniqueNonEmptyStrings(intentDefinition?.requiredToolHints ?? []);
  const toolHints = toolHintsRaw.filter((tool) => availableSet.size === 0 || availableSet.has(tool));
  const requiredToolHints = requiredToolHintsRaw.filter((tool) => availableSet.size === 0 || availableSet.has(tool));
  const missingToolHints = availableSet.size === 0 ? [] : toolHintsRaw.filter((tool) => !availableSet.has(tool));
  const missingRequiredToolHints =
    availableSet.size === 0 ? [] : requiredToolHintsRaw.filter((tool) => !availableSet.has(tool));
  const workflowSuggestedTools = uniqueNonEmptyStrings([...classifierTools, ...requiredToolHints, ...toolHints]);
  const workflowHintSet = new Set([...requiredToolHints, ...toolHints]);
  const memoryPolicy = buildAssistantWorkflowMemoryPolicy(workflow, intent);
  const clarificationPolicy = buildAssistantWorkflowClarificationPolicy(
    workflow,
    intent,
    buildClarificationPolicyInput(classification),
  );
  const plan = buildAssistantWorkflowPlan(workflow, intent, availableToolNames, {
    ...(typeof classification?.subintent === "string" ? { subintent: classification.subintent } : {}),
    ...(typeof classification?.presentation === "string" ? { presentation: classification.presentation } : {}),
    ...(typeof classification?.timeWindowHint === "string" ? { timeWindowHint: classification.timeWindowHint } : {}),
    ...(Array.isArray(classification?.toolsToExpose) ? { toolsToExpose: classification.toolsToExpose } : {}),
    ...(typeof classification?.confidence === "number" ? { confidence: classification.confidence } : {}),
  });

  return {
    intent,
    matchedIntent: intentDefinition !== null,
    defaultPresentation: intentDefinition?.defaultPresentation ?? null,
    effectivePresentation:
      typeof classification?.presentation === "string" && classification.presentation.trim().length
        ? classification.presentation.trim().toLowerCase()
        : intentDefinition?.defaultPresentation ?? null,
    executionBias: intentDefinition?.executionBias ?? null,
    firstHopToolPolicy: intentDefinition ? intentDefinition.firstHopToolPolicy ?? "auto" : null,
    memoryUse: uniqueNonEmptyStrings(intentDefinition?.memoryUse ?? []) as AssistantWorkflowMemoryUse[],
    memoryPolicy,
    clarificationPolicy,
    plan,
    requiredToolHints,
    missingRequiredToolHints,
    toolHints,
    missingToolHints,
    classifierTools,
    workflowSuggestedTools,
    extraClassifierTools: classifierTools.filter((tool) => !workflowHintSet.has(tool)),
  };
}

export function buildAssistantWorkflowDecisionTracePayload(
  decision: AssistantWorkflowDecision,
): Record<string, unknown> {
  return {
    intent: decision.intent,
    matchedIntent: decision.matchedIntent,
    defaultPresentation: decision.defaultPresentation,
    effectivePresentation: decision.effectivePresentation,
    executionBias: decision.executionBias,
    firstHopToolPolicy: decision.firstHopToolPolicy,
    memoryUse: decision.memoryUse,
    memoryPolicy: decision.memoryPolicy,
    clarificationPolicy: decision.clarificationPolicy,
    plan: decision.plan,
    classifierTools: decision.classifierTools,
    requiredToolHints: decision.requiredToolHints,
    missingRequiredToolHints: decision.missingRequiredToolHints,
    toolHints: decision.toolHints,
    missingToolHints: decision.missingToolHints,
    workflowSuggestedTools: decision.workflowSuggestedTools,
    extraClassifierTools: decision.extraClassifierTools,
  };
}

export function shouldRequireAssistantWorkflowFirstHopTool(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
  intentId: unknown,
): boolean {
  return findAssistantWorkflowIntent(workflow, intentId)?.firstHopToolPolicy === "require-tool";
}

function uniqueNonEmptyStrings(values: readonly unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed.length || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function buildClarificationPolicyInput(
  classification: AssistantWorkflowDecisionInput | null | undefined,
): AssistantWorkflowClarificationPolicyInput {
  if (!classification) return {};
  return {
    ...(typeof classification.confidence === "number" ? { confidence: classification.confidence } : {}),
    ...(classification.resolvedScope === true ? { resolvedScope: true } : {}),
    ...(classification.entities !== undefined ? { entities: classification.entities } : {}),
    ...(classification.timeWindowHint !== undefined ? { timeWindowHint: classification.timeWindowHint } : {}),
  };
}
