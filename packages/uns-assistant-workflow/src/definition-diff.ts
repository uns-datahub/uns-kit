import type {
  AssistantWorkflowDirectRouteDefinition,
  AssistantWorkflowDefinition,
  AssistantWorkflowIntentDefinition,
} from "./definition.js";
import type { AssistantWorkflowJsonValue } from "./run-report-json.js";

export type AssistantWorkflowDefinitionIntentDiff = {
  intentId: string;
  addedToolHints: string[];
  removedToolHints: string[];
  addedRequiredToolHints: string[];
  removedRequiredToolHints: string[];
  addedPlanningSteps: string[];
  removedPlanningSteps: string[];
  addedToolSelectionProfileIds: string[];
  removedToolSelectionProfileIds: string[];
  addedPlanningStepProfileIds: string[];
  removedPlanningStepProfileIds: string[];
  addedClarificationRules: string[];
  removedClarificationRules: string[];
  changed: boolean;
};

export type AssistantWorkflowDefinitionDirectRouteDiff = {
  routeId: string;
  addedStrategyIds: string[];
  removedStrategyIds: string[];
  changed: boolean;
};

export type AssistantWorkflowDefinitionPlanningStepDiff = {
  stepId: string;
  addedDependencyStepIds: string[];
  removedDependencyStepIds: string[];
  changed: boolean;
};

export type AssistantWorkflowDefinitionDiff = {
  fromWorkflowId: string;
  toWorkflowId: string;
  fromVersion: number;
  toVersion: number;
  changed: boolean;
  versionChanged: boolean;
  executionBudgetChanged: boolean;
  executionPolicyChanged: boolean;
  addedIntentIds: string[];
  removedIntentIds: string[];
  addedToolNames: string[];
  removedToolNames: string[];
  addedToolBindingNames: string[];
  removedToolBindingNames: string[];
  addedMemorySlotIds: string[];
  removedMemorySlotIds: string[];
  addedDirectRouteIds: string[];
  removedDirectRouteIds: string[];
  addedPlanningStepIds: string[];
  removedPlanningStepIds: string[];
  addedClarificationRuleIds: string[];
  removedClarificationRuleIds: string[];
  intentDiffs: AssistantWorkflowDefinitionIntentDiff[];
  directRouteDiffs: AssistantWorkflowDefinitionDirectRouteDiff[];
  planningStepDiffs: AssistantWorkflowDefinitionPlanningStepDiff[];
};

export function buildAssistantWorkflowDefinitionDiff(
  before: AssistantWorkflowDefinition,
  after: AssistantWorkflowDefinition,
): AssistantWorkflowDefinitionDiff {
  const intentDiffs = buildIntentDiffs(before.intents, after.intents);
  const directRouteDiffs = buildDirectRouteDiffs(before.directRoutes ?? [], after.directRoutes ?? []);
  const planningStepDiffs = buildPlanningStepDiffs(before.planningSteps ?? [], after.planningSteps ?? []);
  const diff: AssistantWorkflowDefinitionDiff = {
    fromWorkflowId: before.id,
    toWorkflowId: after.id,
    fromVersion: before.version,
    toVersion: after.version,
    changed: false,
    versionChanged: before.version !== after.version,
    executionBudgetChanged: !sameJson(before.executionBudget ?? null, after.executionBudget ?? null),
    executionPolicyChanged: !sameJson(before.executionPolicy ?? null, after.executionPolicy ?? null),
    addedIntentIds: diffStrings(before.intents.map((intent) => intent.id), after.intents.map((intent) => intent.id)),
    removedIntentIds: diffStrings(after.intents.map((intent) => intent.id), before.intents.map((intent) => intent.id)),
    addedToolNames: diffStrings(before.tools?.map((tool) => tool.name) ?? [], after.tools?.map((tool) => tool.name) ?? []),
    removedToolNames: diffStrings(after.tools?.map((tool) => tool.name) ?? [], before.tools?.map((tool) => tool.name) ?? []),
    addedToolBindingNames: diffStrings(
      before.toolBindings?.map((binding) => binding.name) ?? [],
      after.toolBindings?.map((binding) => binding.name) ?? [],
    ),
    removedToolBindingNames: diffStrings(
      after.toolBindings?.map((binding) => binding.name) ?? [],
      before.toolBindings?.map((binding) => binding.name) ?? [],
    ),
    addedMemorySlotIds: diffStrings(
      before.memorySlots?.map((slot) => slot.id) ?? [],
      after.memorySlots?.map((slot) => slot.id) ?? [],
    ),
    removedMemorySlotIds: diffStrings(
      after.memorySlots?.map((slot) => slot.id) ?? [],
      before.memorySlots?.map((slot) => slot.id) ?? [],
    ),
    addedDirectRouteIds: diffStrings(
      before.directRoutes?.map((route) => route.id) ?? [],
      after.directRoutes?.map((route) => route.id) ?? [],
    ),
    removedDirectRouteIds: diffStrings(
      after.directRoutes?.map((route) => route.id) ?? [],
      before.directRoutes?.map((route) => route.id) ?? [],
    ),
    addedPlanningStepIds: diffStrings(
      before.planningSteps?.map((step) => step.id) ?? [],
      after.planningSteps?.map((step) => step.id) ?? [],
    ),
    removedPlanningStepIds: diffStrings(
      after.planningSteps?.map((step) => step.id) ?? [],
      before.planningSteps?.map((step) => step.id) ?? [],
    ),
    addedClarificationRuleIds: diffStrings(
      before.clarificationRules?.map((rule) => rule.id) ?? [],
      after.clarificationRules?.map((rule) => rule.id) ?? [],
    ),
    removedClarificationRuleIds: diffStrings(
      after.clarificationRules?.map((rule) => rule.id) ?? [],
      before.clarificationRules?.map((rule) => rule.id) ?? [],
    ),
    intentDiffs,
    directRouteDiffs,
    planningStepDiffs,
  };
  return {
    ...diff,
    changed: diff.versionChanged ||
      diff.executionBudgetChanged ||
      diff.executionPolicyChanged ||
      diff.addedIntentIds.length > 0 ||
      diff.removedIntentIds.length > 0 ||
      diff.addedToolNames.length > 0 ||
      diff.removedToolNames.length > 0 ||
      diff.addedToolBindingNames.length > 0 ||
      diff.removedToolBindingNames.length > 0 ||
      diff.addedMemorySlotIds.length > 0 ||
      diff.removedMemorySlotIds.length > 0 ||
      diff.addedDirectRouteIds.length > 0 ||
      diff.removedDirectRouteIds.length > 0 ||
      diff.addedPlanningStepIds.length > 0 ||
      diff.removedPlanningStepIds.length > 0 ||
      diff.addedClarificationRuleIds.length > 0 ||
      diff.removedClarificationRuleIds.length > 0 ||
      diff.intentDiffs.some((intentDiff) => intentDiff.changed) ||
      diff.directRouteDiffs.some((routeDiff) => routeDiff.changed) ||
      diff.planningStepDiffs.some((stepDiff) => stepDiff.changed),
  };
}

export function buildAssistantWorkflowDefinitionDiffTracePayload(
  diff: AssistantWorkflowDefinitionDiff,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    fromWorkflowId: diff.fromWorkflowId,
    toWorkflowId: diff.toWorkflowId,
    fromVersion: diff.fromVersion,
    toVersion: diff.toVersion,
    changed: diff.changed,
    versionChanged: diff.versionChanged,
    executionBudgetChanged: diff.executionBudgetChanged,
    executionPolicyChanged: diff.executionPolicyChanged,
    addedIntentIds: diff.addedIntentIds,
    removedIntentIds: diff.removedIntentIds,
    addedToolNames: diff.addedToolNames,
    removedToolNames: diff.removedToolNames,
    addedToolBindingNames: diff.addedToolBindingNames,
    removedToolBindingNames: diff.removedToolBindingNames,
    addedMemorySlotIds: diff.addedMemorySlotIds,
    removedMemorySlotIds: diff.removedMemorySlotIds,
    addedDirectRouteIds: diff.addedDirectRouteIds,
    removedDirectRouteIds: diff.removedDirectRouteIds,
    addedPlanningStepIds: diff.addedPlanningStepIds,
    removedPlanningStepIds: diff.removedPlanningStepIds,
    addedClarificationRuleIds: diff.addedClarificationRuleIds,
    removedClarificationRuleIds: diff.removedClarificationRuleIds,
    intentDiffs: diff.intentDiffs.map((intentDiff) => ({
      intentId: intentDiff.intentId,
      addedToolHints: intentDiff.addedToolHints,
      removedToolHints: intentDiff.removedToolHints,
      addedRequiredToolHints: intentDiff.addedRequiredToolHints,
      removedRequiredToolHints: intentDiff.removedRequiredToolHints,
      addedPlanningSteps: intentDiff.addedPlanningSteps,
      removedPlanningSteps: intentDiff.removedPlanningSteps,
      addedToolSelectionProfileIds: intentDiff.addedToolSelectionProfileIds,
      removedToolSelectionProfileIds: intentDiff.removedToolSelectionProfileIds,
      addedPlanningStepProfileIds: intentDiff.addedPlanningStepProfileIds,
      removedPlanningStepProfileIds: intentDiff.removedPlanningStepProfileIds,
      addedClarificationRules: intentDiff.addedClarificationRules,
      removedClarificationRules: intentDiff.removedClarificationRules,
      changed: intentDiff.changed,
    })),
    directRouteDiffs: diff.directRouteDiffs.map((routeDiff) => ({
      routeId: routeDiff.routeId,
      addedStrategyIds: routeDiff.addedStrategyIds,
      removedStrategyIds: routeDiff.removedStrategyIds,
      changed: routeDiff.changed,
    })),
    planningStepDiffs: diff.planningStepDiffs.map((stepDiff) => ({
      stepId: stepDiff.stepId,
      addedDependencyStepIds: stepDiff.addedDependencyStepIds,
      removedDependencyStepIds: stepDiff.removedDependencyStepIds,
      changed: stepDiff.changed,
    })),
  };
}

function buildPlanningStepDiffs(
  beforeSteps: readonly NonNullable<AssistantWorkflowDefinition["planningSteps"]>[number][],
  afterSteps: readonly NonNullable<AssistantWorkflowDefinition["planningSteps"]>[number][],
): AssistantWorkflowDefinitionPlanningStepDiff[] {
  const beforeById = new Map(beforeSteps.map((step) => [step.id, step] as const));
  const diffs: AssistantWorkflowDefinitionPlanningStepDiff[] = [];
  for (const afterStep of afterSteps) {
    const beforeStep = beforeById.get(afterStep.id);
    if (!beforeStep) continue;
    const addedDependencyStepIds = diffStrings(beforeStep.dependsOn ?? [], afterStep.dependsOn ?? []);
    const removedDependencyStepIds = diffStrings(afterStep.dependsOn ?? [], beforeStep.dependsOn ?? []);
    if (addedDependencyStepIds.length || removedDependencyStepIds.length) {
      diffs.push({
        stepId: afterStep.id,
        addedDependencyStepIds,
        removedDependencyStepIds,
        changed: true,
      });
    }
  }
  return diffs.sort((left, right) => left.stepId.localeCompare(right.stepId));
}

function buildDirectRouteDiffs(
  beforeRoutes: readonly AssistantWorkflowDirectRouteDefinition[],
  afterRoutes: readonly AssistantWorkflowDirectRouteDefinition[],
): AssistantWorkflowDefinitionDirectRouteDiff[] {
  const beforeById = new Map(beforeRoutes.map((route) => [route.id, route]));
  const diffs: AssistantWorkflowDefinitionDirectRouteDiff[] = [];

  for (const afterRoute of afterRoutes) {
    const beforeRoute = beforeById.get(afterRoute.id);
    if (!beforeRoute) continue;
    const diff = buildDirectRouteDiff(beforeRoute, afterRoute);
    if (diff.changed) diffs.push(diff);
  }
  return diffs.sort((left, right) => left.routeId.localeCompare(right.routeId));
}

function buildDirectRouteDiff(
  before: AssistantWorkflowDirectRouteDefinition,
  after: AssistantWorkflowDirectRouteDefinition,
): AssistantWorkflowDefinitionDirectRouteDiff {
  const diff: AssistantWorkflowDefinitionDirectRouteDiff = {
    routeId: after.id,
    addedStrategyIds: diffStrings(
      before.strategies?.map((strategy) => strategy.id) ?? [],
      after.strategies?.map((strategy) => strategy.id) ?? [],
    ),
    removedStrategyIds: diffStrings(
      after.strategies?.map((strategy) => strategy.id) ?? [],
      before.strategies?.map((strategy) => strategy.id) ?? [],
    ),
    changed: false,
  };
  return {
    ...diff,
    changed: diff.addedStrategyIds.length > 0 || diff.removedStrategyIds.length > 0,
  };
}

function buildIntentDiffs(
  beforeIntents: readonly AssistantWorkflowIntentDefinition[],
  afterIntents: readonly AssistantWorkflowIntentDefinition[],
): AssistantWorkflowDefinitionIntentDiff[] {
  const beforeById = new Map(beforeIntents.map((intent) => [intent.id, intent]));
  const diffs: AssistantWorkflowDefinitionIntentDiff[] = [];

  for (const afterIntent of afterIntents) {
    const beforeIntent = beforeById.get(afterIntent.id);
    if (!beforeIntent) continue;
    const diff = buildIntentDiff(beforeIntent, afterIntent);
    if (diff.changed) diffs.push(diff);
  }
  return diffs.sort((left, right) => left.intentId.localeCompare(right.intentId));
}

function buildIntentDiff(
  before: AssistantWorkflowIntentDefinition,
  after: AssistantWorkflowIntentDefinition,
): AssistantWorkflowDefinitionIntentDiff {
  const diff: AssistantWorkflowDefinitionIntentDiff = {
    intentId: after.id,
    addedToolHints: diffStrings(before.toolHints ?? [], after.toolHints ?? []),
    removedToolHints: diffStrings(after.toolHints ?? [], before.toolHints ?? []),
    addedRequiredToolHints: diffStrings(before.requiredToolHints ?? [], after.requiredToolHints ?? []),
    removedRequiredToolHints: diffStrings(after.requiredToolHints ?? [], before.requiredToolHints ?? []),
    addedPlanningSteps: diffStrings(before.planningSteps ?? [], after.planningSteps ?? []),
    removedPlanningSteps: diffStrings(after.planningSteps ?? [], before.planningSteps ?? []),
    addedToolSelectionProfileIds: diffStrings(
      before.toolSelectionProfiles?.map((profile) => profile.id) ?? [],
      after.toolSelectionProfiles?.map((profile) => profile.id) ?? [],
    ),
    removedToolSelectionProfileIds: diffStrings(
      after.toolSelectionProfiles?.map((profile) => profile.id) ?? [],
      before.toolSelectionProfiles?.map((profile) => profile.id) ?? [],
    ),
    addedPlanningStepProfileIds: diffStrings(
      before.planningStepProfiles?.map((profile) => profile.id) ?? [],
      after.planningStepProfiles?.map((profile) => profile.id) ?? [],
    ),
    removedPlanningStepProfileIds: diffStrings(
      after.planningStepProfiles?.map((profile) => profile.id) ?? [],
      before.planningStepProfiles?.map((profile) => profile.id) ?? [],
    ),
    addedClarificationRules: diffStrings(before.clarificationRules ?? [], after.clarificationRules ?? []),
    removedClarificationRules: diffStrings(after.clarificationRules ?? [], before.clarificationRules ?? []),
    changed: false,
  };
  return {
    ...diff,
    changed: diff.addedToolHints.length > 0 ||
      diff.removedToolHints.length > 0 ||
      diff.addedRequiredToolHints.length > 0 ||
      diff.removedRequiredToolHints.length > 0 ||
      diff.addedPlanningSteps.length > 0 ||
      diff.removedPlanningSteps.length > 0 ||
      diff.addedToolSelectionProfileIds.length > 0 ||
      diff.removedToolSelectionProfileIds.length > 0 ||
      diff.addedPlanningStepProfileIds.length > 0 ||
      diff.removedPlanningStepProfileIds.length > 0 ||
      diff.addedClarificationRules.length > 0 ||
      diff.removedClarificationRules.length > 0,
  };
}

function diffStrings(before: readonly string[], after: readonly string[]): string[] {
  const beforeSet = new Set(before);
  return [...new Set(after)]
    .filter((value) => value.length > 0 && !beforeSet.has(value))
    .sort();
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
