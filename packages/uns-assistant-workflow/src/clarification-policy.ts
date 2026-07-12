import {
  findAssistantWorkflowIntent,
  normalizeAssistantWorkflowId,
  type AssistantWorkflowClarificationCondition,
  type AssistantWorkflowClarificationQuestionStyle,
  type AssistantWorkflowClarificationRuleDefinition,
  type AssistantWorkflowDefinition,
  type AssistantWorkflowEntityKind,
} from "./definition.js";

export type AssistantWorkflowClarificationPolicyInput = {
  confidence?: number | null;
  /** A host has already established one trusted, concrete scope. */
  resolvedScope?: boolean;
  /** A deterministic resolver returned multiple concrete candidates for one requested scope. */
  resolverCandidatesAmbiguous?: boolean;
  entities?: {
    containers?: readonly string[] | null;
    attributes?: readonly string[] | null;
    fullTopicPaths?: readonly string[] | null;
  } | null;
  timeWindowHint?: string | null;
};

export type AssistantWorkflowClarificationRuleTrace = {
  id: string;
  condition: AssistantWorkflowClarificationCondition;
  questionStyle: AssistantWorkflowClarificationQuestionStyle;
  priority: number;
  blocksExecution: boolean;
  satisfiedByResolvedScope: boolean;
  confidenceBelow: number | null;
  requiredEntityKinds: AssistantWorkflowEntityKind[];
  readsMemory: string[];
  writesMemory: string[];
};

export type AssistantWorkflowResolvedClarificationPolicy = {
  ruleIds: string[];
  rules: AssistantWorkflowClarificationRuleTrace[];
  blockingRuleIds: string[];
  suggestedRuleIds: string[];
  missingClarificationRules: string[];
  needsClarification: boolean;
  resolvedScope: boolean;
  reasons: string[];
};

export type AssistantWorkflowObservedClarification = {
  produced: boolean;
  ruleId?: string | null;
  source?: string | null;
  layer?: string | null;
  reason?: string | null;
};

export type AssistantWorkflowClarificationRuntimeComparisonOptions = {
  equivalentRuleIds?: Record<string, readonly string[]>;
};

export type AssistantWorkflowClarificationRuntimeComparison = {
  expectedRuleIds: string[];
  expectedBlockingRuleIds: string[];
  expectedSuggestedRuleIds: string[];
  produced: boolean;
  observedRuleId: string | null;
  equivalentRuleIds: string[];
  matched: boolean;
  missingExpectedRuleIds: string[];
  unexpectedObservedRuleId: string | null;
  source: string | null;
  layer: string | null;
  reason: string | null;
};

export function findAssistantWorkflowClarificationRule(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
  ruleId: unknown,
): AssistantWorkflowClarificationRuleDefinition | null {
  const normalized = normalizeAssistantWorkflowId(ruleId);
  if (!normalized) return null;
  return (workflow.clarificationRules ?? []).find((rule) => rule.id === normalized) ?? null;
}

export function buildAssistantWorkflowClarificationPolicy(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
  intentId: unknown,
  input: AssistantWorkflowClarificationPolicyInput = {},
): AssistantWorkflowResolvedClarificationPolicy {
  const intent = findAssistantWorkflowIntent(workflow, intentId);
  const rulesById = new Map((workflow.clarificationRules ?? []).map((rule) => [rule.id, rule] as const));
  const rules: AssistantWorkflowClarificationRuleDefinition[] = [];
  const missingClarificationRules: string[] = [];
  const seen = new Set<string>();

  for (const rawRuleId of intent?.clarificationRules ?? []) {
    const ruleId = normalizeAssistantWorkflowId(rawRuleId);
    if (!ruleId || seen.has(ruleId)) continue;
    seen.add(ruleId);
    const rule = rulesById.get(ruleId);
    if (rule) {
      rules.push(rule);
    } else {
      missingClarificationRules.push(ruleId);
    }
  }

  const sortedRules = [...rules].sort((left, right) => getPriority(left) - getPriority(right));
  const suggested = sortedRules
    .map((rule) => evaluateRule(rule, intent?.id ?? null, input))
    .filter((result): result is { ruleId: string; reason: string } => result !== null);
  const suggestedRuleIds = suggested.map((result) => result.ruleId);
  const suggestedSet = new Set(suggestedRuleIds);
  const blockingRuleIds = sortedRules
    .filter((rule) => rule.blocksExecution === true && suggestedSet.has(rule.id))
    .map((rule) => rule.id);

  return {
    ruleIds: sortedRules.map((rule) => rule.id),
    rules: sortedRules.map(ruleToTrace),
    blockingRuleIds,
    suggestedRuleIds,
    missingClarificationRules,
    needsClarification: blockingRuleIds.length > 0,
    resolvedScope: input.resolvedScope === true,
    reasons: suggested.map((result) => result.reason),
  };
}

export function buildAssistantWorkflowClarificationRuntimeComparison(
  policy: AssistantWorkflowResolvedClarificationPolicy,
  observed: AssistantWorkflowObservedClarification,
  options: AssistantWorkflowClarificationRuntimeComparisonOptions = {},
): AssistantWorkflowClarificationRuntimeComparison {
  const observedRuleId = normalizeAssistantWorkflowId(observed.ruleId);
  const equivalentRuleIds = observedRuleId
    ? uniqueStrings([observedRuleId, ...(options.equivalentRuleIds?.[observedRuleId] ?? [])])
    : [];
  const expectedRuleIds = policy.blockingRuleIds.length ? policy.blockingRuleIds : policy.suggestedRuleIds;
  const matched = observed.produced
    ? equivalentRuleIds.some((ruleId) => expectedRuleIds.includes(ruleId))
    : policy.blockingRuleIds.length === 0;
  const missingExpectedRuleIds = observed.produced
    ? expectedRuleIds.filter((ruleId) => !equivalentRuleIds.includes(ruleId))
    : [...policy.blockingRuleIds];
  const unexpectedObservedRuleId = observed.produced && observedRuleId && !matched ? observedRuleId : null;

  return {
    expectedRuleIds,
    expectedBlockingRuleIds: [...policy.blockingRuleIds],
    expectedSuggestedRuleIds: [...policy.suggestedRuleIds],
    produced: observed.produced,
    observedRuleId,
    equivalentRuleIds,
    matched,
    missingExpectedRuleIds,
    unexpectedObservedRuleId,
    source: normalizeOptionalText(observed.source),
    layer: normalizeOptionalText(observed.layer),
    reason: normalizeOptionalText(observed.reason),
  };
}

function evaluateRule(
  rule: AssistantWorkflowClarificationRuleDefinition,
  intentId: string | null,
  input: AssistantWorkflowClarificationPolicyInput,
): { ruleId: string; reason: string } | null {
  if (input.resolvedScope === true && rule.satisfiedByResolvedScope === true) {
    return null;
  }
  switch (rule.condition) {
    case "low_confidence": {
      const threshold = rule.confidenceBelow ?? 0.55;
      const confidence = typeof input.confidence === "number" && Number.isFinite(input.confidence)
        ? input.confidence
        : null;
      if (confidence !== null && confidence < threshold) {
        return { ruleId: rule.id, reason: `confidence ${confidence} below ${threshold}` };
      }
      return null;
    }
    case "missing_required_entity": {
      const requiredKinds = rule.requiredEntityKinds ?? [];
      const missingKinds = requiredKinds.filter((kind) => !hasEntityKind(input, kind));
      if (missingKinds.length === requiredKinds.length && requiredKinds.length > 0) {
        return { ruleId: rule.id, reason: `missing required entity scope: ${missingKinds.join(", ")}` };
      }
      return null;
    }
    case "multiple_entity_candidates": {
      const candidateKinds = rule.requiredEntityKinds?.length
        ? rule.requiredEntityKinds
        : ["container", "attribute", "full_topic_path"] as const;
      const ambiguousKinds = candidateKinds.filter((kind) => getEntityCount(input, kind) > 1);
      if (ambiguousKinds.length > 0) {
        return { ruleId: rule.id, reason: `multiple entity candidates: ${ambiguousKinds.join(", ")}` };
      }
      return null;
    }
    case "resolver_candidates_ambiguous":
      return input.resolverCandidatesAmbiguous === true
        ? { ruleId: rule.id, reason: "resolver returned multiple concrete scope candidates" }
        : null;
    case "fallback_intent":
      return intentId === null || intentId === "other"
        ? { ruleId: rule.id, reason: "fallback intent requires user clarification" }
        : null;
  }
}

function ruleToTrace(rule: AssistantWorkflowClarificationRuleDefinition): AssistantWorkflowClarificationRuleTrace {
  return {
    id: rule.id,
    condition: rule.condition,
    questionStyle: rule.questionStyle,
    priority: getPriority(rule),
    blocksExecution: rule.blocksExecution === true,
    satisfiedByResolvedScope: rule.satisfiedByResolvedScope === true,
    confidenceBelow: typeof rule.confidenceBelow === "number" ? rule.confidenceBelow : null,
    requiredEntityKinds: [...(rule.requiredEntityKinds ?? [])],
    readsMemory: uniqueStrings(rule.readsMemory ?? []),
    writesMemory: uniqueStrings(rule.writesMemory ?? []),
  };
}

function getPriority(rule: AssistantWorkflowClarificationRuleDefinition): number {
  return typeof rule.priority === "number" && Number.isFinite(rule.priority) ? rule.priority : 100;
}

function hasEntityKind(input: AssistantWorkflowClarificationPolicyInput, kind: AssistantWorkflowEntityKind): boolean {
  if (kind === "time_window") {
    return typeof input.timeWindowHint === "string" && input.timeWindowHint.trim().length > 0;
  }
  return getEntityCount(input, kind) > 0;
}

function getEntityCount(input: AssistantWorkflowClarificationPolicyInput, kind: AssistantWorkflowEntityKind): number {
  const entities = input.entities;
  if (!entities) return 0;
  if (kind === "container") return countStrings(entities.containers);
  if (kind === "attribute") return countStrings(entities.attributes);
  if (kind === "full_topic_path") return countStrings(entities.fullTopicPaths);
  return 0;
}

function countStrings(values: readonly string[] | null | undefined): number {
  if (!Array.isArray(values)) return 0;
  return values.filter((value) => typeof value === "string" && value.trim().length > 0).length;
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

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized?.length ? normalized : null;
}
