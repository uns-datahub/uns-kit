import {
  findAssistantWorkflowIntent,
  type AssistantWorkflowDefinition,
  type AssistantWorkflowOptionalToolSelectionMode,
  type AssistantWorkflowToolContextRequirement,
} from "./definition.js";
import type { AssistantWorkflowDecision, AssistantWorkflowDecisionInput } from "./decision.js";
import {
  buildAssistantWorkflowRun,
  buildAssistantWorkflowRunTracePayload,
} from "./run.js";
import { summarizeAssistantWorkflowToolCapabilities } from "./tool-capabilities.js";
import {
  readAssistantWorkflowString as normalizeNullableString,
  readAssistantWorkflowStringArray as readStringArray,
} from "./value-readers.js";

export type { AssistantWorkflowOptionalToolSelectionMode } from "./definition.js";

export type AssistantWorkflowToolSelectionCandidate = {
  optionalToolSelectionMode: AssistantWorkflowOptionalToolSelectionMode;
  toolNames: string[];
  classifierToolNames: string[];
  requiredToolNames: string[];
  optionalToolNames: string[];
  excludedOptionalToolNames: string[];
  activeProfileIds: string[];
  profileToolNames: string[];
  profileExcludedToolNames: string[];
};

export type AssistantWorkflowToolSelectionCandidateInput = {
  workflow: AssistantWorkflowDefinition<string, string, string, string>;
  decision: Pick<
    AssistantWorkflowDecision,
    "intent" | "classifierTools" | "requiredToolHints" | "toolHints" | "workflowSuggestedTools"
  >;
  availableToolNames?: readonly string[] | null;
  hop?: number | null;
  selectedReason?: string | null;
  resolvedScope?: boolean;
  attributeCount?: number | null;
};

export type AssistantWorkflowToolSelectionAuthoritySource = "workflow" | "legacy-pruner";

export type AssistantWorkflowToolSelectionAuthorityReason =
  | "workflow_equivalent"
  | "workflow_authority_enabled"
  | "workflow_unavailable"
  | "workflow_authority_not_enabled"
  | "workflow_blocked"
  | "workflow_differs";

export type AssistantWorkflowToolSelectionAuthority = {
  source: AssistantWorkflowToolSelectionAuthoritySource;
  reason: AssistantWorkflowToolSelectionAuthorityReason;
  selectedToolNames: string[];
  workflowSuggestedToolNames: string[];
  workflowStatus: string | null;
};

export type AssistantWorkflowToolSelectionAuthorityInput = {
  selectedToolNames: readonly string[];
  workflowAvailable: boolean;
  workflowSuggestedToolNames?: readonly string[] | null;
  workflowSelectionCandidateToolNames?: readonly string[] | null;
  workflowStatus?: string | null;
  workflowAuthorityEnabled?: boolean | null;
};

export type AssistantWorkflowToolSelectionComparisonInput = {
  workflow: AssistantWorkflowDefinition<string, string, string, string>;
  classification?: AssistantWorkflowDecisionInput | null;
  availableToolNames?: readonly string[] | null;
  selectedToolNames: readonly string[];
  selectedMode?: string | null;
  selectedReason?: string | null;
  hop?: number | null;
  pruningEnabled?: boolean | null;
  availableContext?: readonly AssistantWorkflowToolContextRequirement[] | null;
  resolvedScope?: boolean;
  workflowAuthorityIntentIds?: readonly string[] | null;
  workflowAuthoritySegmentKeys?: readonly string[] | null;
  workflowAuthorityProfileKeys?: readonly string[] | null;
};

export type AssistantWorkflowToolSelectionDecisionInput = AssistantWorkflowToolSelectionComparisonInput;

export type AssistantWorkflowToolSelectionDecision = {
  comparisonPayload: Record<string, unknown> | null;
  authority: AssistantWorkflowToolSelectionAuthority;
  effectiveToolNames: string[];
  effectiveReason: string | null;
};

export function buildAssistantWorkflowToolSelectionCandidate(
  input: AssistantWorkflowToolSelectionCandidateInput,
): AssistantWorkflowToolSelectionCandidate {
  const intent = findAssistantWorkflowIntent(input.workflow, input.decision.intent);
  const optionalToolSelectionMode = intent?.optionalToolSelectionMode ?? "classifier-confirmed";
  const classifierToolNames = uniqueStrings(input.decision.classifierTools);
  const requiredToolNames = uniqueStrings(input.decision.requiredToolHints);
  const optionalToolNames = uniqueStrings(input.decision.toolHints)
    .filter((toolName) => !requiredToolNames.includes(toolName));
  const classifierToolSet = new Set(classifierToolNames);
  const availableToolNameSet = buildOptionalToolNameSet(input.availableToolNames);
  const activeProfiles = (intent?.toolSelectionProfiles ?? [])
    .filter((profile) => toolSelectionProfileConditionMatches(profile.condition, {
      hop: input.hop ?? null,
      selectedReason: input.selectedReason ?? null,
      resolvedScope: input.resolvedScope === true,
      attributeCount: input.attributeCount ?? null,
      classifierToolNames: classifierToolSet,
    }));
  const activeProfileIds = uniqueStrings(activeProfiles.map((profile) => profile.id));
  const profileToolNames = uniqueStrings(activeProfiles.flatMap((profile) => {
    const mode = profile.optionalToolSelectionMode ?? "workflow-suggested";
    const profileToolHints = uniqueStrings(profile.toolHints)
      .filter((toolName) => !availableToolNameSet || availableToolNameSet.has(toolName));
    return mode === "workflow-suggested"
      ? profileToolHints
      : profileToolHints.filter((toolName) => classifierToolSet.has(toolName));
  }));
  const profileExcludedToolNames = uniqueStrings(activeProfiles.flatMap((profile) => profile.toolExclusions ?? []));
  const requiredToolSet = new Set(requiredToolNames);
  const profileExcludedToolSet = new Set(profileExcludedToolNames.filter((toolName) => !requiredToolSet.has(toolName)));
  const allowedOptionalToolNames = optionalToolSelectionMode === "workflow-suggested"
    ? optionalToolNames
    : optionalToolNames.filter((toolName) => classifierToolSet.has(toolName));
  const allowedOptionalToolSet = new Set(allowedOptionalToolNames);
  const allowedSet = new Set([
    ...classifierToolNames,
    ...requiredToolNames,
    ...allowedOptionalToolNames,
    ...profileToolNames,
  ]);
  const toolNames = orderToolNamesByAvailableCatalog(uniqueStrings([
    ...input.decision.workflowSuggestedTools.filter((toolName) => allowedSet.has(toolName)),
    ...classifierToolNames,
    ...requiredToolNames,
    ...allowedOptionalToolNames,
    ...profileToolNames,
  ]).filter((toolName) => !profileExcludedToolSet.has(toolName)), input.availableToolNames);

  return {
    optionalToolSelectionMode,
    toolNames,
    classifierToolNames,
    requiredToolNames,
    optionalToolNames,
    excludedOptionalToolNames: uniqueStrings([
      ...optionalToolNames.filter((toolName) => !allowedOptionalToolSet.has(toolName)),
      ...optionalToolNames.filter((toolName) => profileExcludedToolSet.has(toolName)),
    ]),
    activeProfileIds,
    profileToolNames: orderToolNamesByAvailableCatalog(profileToolNames, input.availableToolNames),
    profileExcludedToolNames: orderToolNamesByAvailableCatalog(profileExcludedToolNames, input.availableToolNames),
  };
}

export function buildAssistantWorkflowToolSelectionDecision(
  input: AssistantWorkflowToolSelectionDecisionInput,
): AssistantWorkflowToolSelectionDecision {
  const selectedToolNames = uniqueStrings(input.selectedToolNames);
  const comparisonPayload = buildAssistantWorkflowToolSelectionComparisonPayload(input);
  const workflowAuthorityEnabled = comparisonPayload
    ? isWorkflowAuthorityEnabled(input, comparisonPayload)
    : false;
  const authority = comparisonPayload
    ? buildAssistantWorkflowToolSelectionAuthority({
        selectedToolNames,
        workflowAvailable: true,
        workflowSuggestedToolNames: readStringArray(comparisonPayload["workflowSuggestedTools"]),
        workflowSelectionCandidateToolNames: readStringArray(comparisonPayload["workflowSelectionCandidateTools"]),
        workflowStatus: readWorkflowStatus(comparisonPayload),
        workflowAuthorityEnabled,
      })
    : buildAssistantWorkflowToolSelectionAuthority({
        selectedToolNames,
        workflowAvailable: false,
      });
  const gatedAuthority = applyWorkflowAuthorityIntentGate(authority, input, comparisonPayload);
  const effectiveReason = gatedAuthority.source === "workflow"
    ? gatedAuthority.reason
    : normalizeNullableString(input.selectedReason);
  const effectiveToolNames = gatedAuthority.source === "workflow"
    ? [...gatedAuthority.selectedToolNames]
    : selectedToolNames;

  return {
    comparisonPayload: comparisonPayload
      ? {
          ...comparisonPayload,
          selectedReason: effectiveReason,
          selectedToolCount: effectiveToolNames.length,
          workflowAuthoritySegmentKey: buildAssistantWorkflowToolSelectionSegmentKey({
            intentId: normalizeNullableString(input.classification?.intent) ?? "unknown",
            hop: input.hop ?? null,
            selectedReason: input.selectedReason ?? null,
          }),
          workflowAuthorityIntentIds: normalizeOptionalStringList(input.workflowAuthorityIntentIds),
          workflowAuthoritySegmentKeys: normalizeOptionalStringList(input.workflowAuthoritySegmentKeys),
          workflowAuthorityProfileKeys: normalizeOptionalStringList(input.workflowAuthorityProfileKeys),
          authority: gatedAuthority,
        }
      : null,
    authority: gatedAuthority,
    effectiveToolNames,
    effectiveReason,
  };
}

export function buildAssistantWorkflowToolSelectionComparisonPayload(
  input: AssistantWorkflowToolSelectionComparisonInput,
): Record<string, unknown> | null {
  if (!input.classification) return null;

  const selectedToolNames = uniqueStrings(input.selectedToolNames);
  const workflowRun = buildAssistantWorkflowRun(input.workflow, {
    classification: {
      ...input.classification,
      ...(input.resolvedScope === true ? { resolvedScope: true } : {}),
    },
    availableToolNames: input.availableToolNames ?? [],
    availableContext: input.availableContext ?? null,
  });
  const workflowDecision = workflowRun.decision;
  const workflowSelectionCandidate = buildAssistantWorkflowToolSelectionCandidate({
    workflow: input.workflow,
    decision: workflowDecision,
    availableToolNames: input.availableToolNames ?? [],
    hop: input.hop ?? null,
    selectedReason: input.selectedReason ?? null,
    resolvedScope: input.resolvedScope === true,
    attributeCount: countDistinctAttributes(input.classification?.entities?.attributes),
  });
  const selectedSet = new Set(selectedToolNames);
  const workflowSet = new Set(workflowDecision.workflowSuggestedTools);
  const workflowSelectionCandidateSet = new Set(workflowSelectionCandidate.toolNames);
  const workflowAuthorityProfileKey = buildAssistantWorkflowToolSelectionProfileKey({
    intentId: workflowDecision.intent,
    profileIds: workflowSelectionCandidate.activeProfileIds,
  });
  const runTrace = buildAssistantWorkflowRunTracePayload(workflowRun);
  const decisionTrace = runTrace["decision"] as Record<string, unknown>;
  const executionPlanTrace = runTrace["executionPlan"] as Record<string, unknown>;

  return {
    ...(typeof input.hop === "number" ? { hop: input.hop } : {}),
    ...(typeof input.pruningEnabled === "boolean" ? { pruningEnabled: input.pruningEnabled } : {}),
    // Keep workflow identity flat so bounded trace payload sanitizers retain it
    // even when the detailed workflowRun object is omitted.
    workflowId: workflowRun.workflowId,
    workflowVersion: workflowRun.workflowVersion,
    resolvedScope: input.resolvedScope === true,
    ...(input.selectedMode ? { selectedMode: input.selectedMode } : {}),
    ...(input.selectedReason ? { selectedReason: input.selectedReason } : {}),
    selectedToolCount: selectedToolNames.length,
    ...decisionTrace,
    workflowRun: runTrace,
    executionPlan: executionPlanTrace,
    workflowSelectionCandidateTools: workflowSelectionCandidate.toolNames,
    workflowSelectionOptionalToolMode: workflowSelectionCandidate.optionalToolSelectionMode,
    workflowSelectionExcludedOptionalTools: workflowSelectionCandidate.excludedOptionalToolNames,
    workflowSelectionActiveProfileIds: workflowSelectionCandidate.activeProfileIds,
    workflowSelectionProfileTools: workflowSelectionCandidate.profileToolNames,
    workflowSelectionProfileExcludedTools: workflowSelectionCandidate.profileExcludedToolNames,
    ...(workflowAuthorityProfileKey ? { workflowAuthorityProfileKey } : {}),
    missingWorkflowSuggestedTools: workflowDecision.workflowSuggestedTools.filter((tool) => !selectedSet.has(tool)),
    missingWorkflowSelectionCandidateTools: workflowSelectionCandidate.toolNames.filter((tool) => !selectedSet.has(tool)),
    selectedOutsideWorkflowSuggestions: selectedToolNames.filter((tool) => !workflowSet.has(tool)),
    selectedOutsideWorkflowSelectionCandidate: selectedToolNames.filter((tool) => !workflowSelectionCandidateSet.has(tool)),
    selectedToolCapabilitySummary: summarizeAssistantWorkflowToolCapabilities(
      input.workflow,
      selectedToolNames,
    ),
    workflowSuggestedToolCapabilitySummary: summarizeAssistantWorkflowToolCapabilities(
      input.workflow,
      workflowDecision.workflowSuggestedTools,
    ),
    workflowSelectionCandidateToolCapabilitySummary: summarizeAssistantWorkflowToolCapabilities(
      input.workflow,
      workflowSelectionCandidate.toolNames,
    ),
  };
}

function toolSelectionProfileConditionMatches(
  condition: NonNullable<AssistantWorkflowDefinition<string, string, string, string>["intents"][number]["toolSelectionProfiles"]>[number]["condition"],
  input: {
    hop: number | null;
    selectedReason: string | null;
    resolvedScope: boolean;
    attributeCount: number | null;
    classifierToolNames: ReadonlySet<string>;
  },
): boolean {
  if (!condition) return true;
  if (condition.minHop !== undefined && (input.hop === null || input.hop < condition.minHop)) return false;
  if (condition.maxHop !== undefined && (input.hop === null || input.hop > condition.maxHop)) return false;
  if (condition.selectedReason !== undefined) {
    const expectedReason = normalizeNullableString(condition.selectedReason);
    if (expectedReason === null || normalizeNullableString(input.selectedReason) !== expectedReason) return false;
  }
  if (condition.resolvedScope !== undefined && condition.resolvedScope !== input.resolvedScope) return false;
  if (
    condition.minAttributeCount !== undefined &&
    (input.attributeCount === null || input.attributeCount < condition.minAttributeCount)
  ) {
    return false;
  }
  if (
    condition.maxAttributeCount !== undefined &&
    (input.attributeCount === null || input.attributeCount > condition.maxAttributeCount)
  ) {
    return false;
  }
  if (
    condition.requiredClassifierTools !== undefined &&
    !condition.requiredClassifierTools.every((toolName) => input.classifierToolNames.has(toolName))
  ) {
    return false;
  }
  return true;
}

function countDistinctAttributes(values: readonly string[] | null | undefined): number | null {
  if (!Array.isArray(values)) return null;
  return new Set(
    values
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim().toLocaleLowerCase())
      .filter((value) => value.length > 0),
  ).size;
}

function buildOptionalToolNameSet(values: readonly unknown[] | null | undefined): Set<string> | null {
  const toolNames = normalizeOptionalStringList(values);
  return toolNames === null || toolNames.length === 0 ? null : new Set(toolNames);
}

function orderToolNamesByAvailableCatalog(
  toolNames: string[],
  availableToolNames: readonly unknown[] | null | undefined,
): string[] {
  const availableOrder = normalizeOptionalStringList(availableToolNames);
  if (!availableOrder?.length) return toolNames;
  const toolNameSet = new Set(toolNames);
  const ordered = availableOrder.filter((toolName) => toolNameSet.has(toolName));
  return uniqueStrings([
    ...ordered,
    ...toolNames.filter((toolName) => !ordered.includes(toolName)),
  ]);
}

export function buildAssistantWorkflowToolSelectionAuthority(
  input: AssistantWorkflowToolSelectionAuthorityInput,
): AssistantWorkflowToolSelectionAuthority {
  const selectedToolNames = uniqueStrings(input.selectedToolNames);
  const workflowSuggestedToolNames = uniqueStrings(input.workflowSuggestedToolNames ?? []);
  const workflowSelectionCandidateToolNames = uniqueStrings(input.workflowSelectionCandidateToolNames ?? []);
  const workflowStatus = normalizeNullableString(input.workflowStatus);
  const comparableWorkflowToolNames = workflowSelectionCandidateToolNames.length > 0
    ? workflowSelectionCandidateToolNames
    : workflowSuggestedToolNames;

  if (!input.workflowAvailable) {
    return {
      source: "legacy-pruner",
      reason: "workflow_unavailable",
      selectedToolNames,
      workflowSuggestedToolNames,
      workflowStatus: null,
    };
  }

  if (workflowStatus === "blocked" || workflowStatus === "needs-clarification") {
    return {
      source: "legacy-pruner",
      reason: "workflow_blocked",
      selectedToolNames,
      workflowSuggestedToolNames,
      workflowStatus,
    };
  }

  if (input.workflowAuthorityEnabled && comparableWorkflowToolNames.length > 0) {
    return {
      source: "workflow",
      reason: sameStringSet(selectedToolNames, comparableWorkflowToolNames)
        ? "workflow_equivalent"
        : "workflow_authority_enabled",
      selectedToolNames: comparableWorkflowToolNames,
      workflowSuggestedToolNames,
      workflowStatus,
    };
  }

  if (comparableWorkflowToolNames.length > 0 && sameStringSet(selectedToolNames, comparableWorkflowToolNames)) {
    return {
      source: "workflow",
      reason: "workflow_equivalent",
      selectedToolNames: comparableWorkflowToolNames,
      workflowSuggestedToolNames,
      workflowStatus,
    };
  }

  return {
    source: "legacy-pruner",
    reason: "workflow_differs",
    selectedToolNames,
    workflowSuggestedToolNames,
    workflowStatus,
  };
}

export function buildAssistantWorkflowToolSelectionSegmentKey(input: {
  intentId: string | null;
  hop: number | null;
  selectedReason: string | null;
}): string {
  return `${normalizeNullableString(input.intentId) ?? "unknown"}|hop:${input.hop ?? "unknown"}|${
    normalizeNullableString(input.selectedReason) ?? "unknown"
  }`;
}

/**
 * Exact active profile combinations are authority scopes. A single profile can
 * be safe in one combination and unsafe in another, so profile ids are sorted
 * and retained together with the intent.
 */
export function buildAssistantWorkflowToolSelectionProfileKey(input: {
  intentId: string | null;
  profileIds: readonly unknown[] | null | undefined;
}): string | null {
  const intentId = normalizeNullableString(input.intentId);
  const profileIds = uniqueStrings(input.profileIds ?? []).sort((left, right) => left.localeCompare(right));
  if (!intentId || !profileIds.length) return null;
  return `${intentId}|profiles:${profileIds.join(",")}`;
}

function uniqueStrings(values: readonly unknown[]): string[] {
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

function applyWorkflowAuthorityIntentGate(
  authority: AssistantWorkflowToolSelectionAuthority,
  input: AssistantWorkflowToolSelectionDecisionInput,
  comparisonPayload: Record<string, unknown> | null,
): AssistantWorkflowToolSelectionAuthority {
  const enabledIntentIds = normalizeOptionalStringList(input.workflowAuthorityIntentIds);
  const enabledSegmentKeys = normalizeOptionalStringList(input.workflowAuthoritySegmentKeys);
  const enabledProfileKeys = normalizeOptionalStringList(input.workflowAuthorityProfileKeys);
  if (enabledIntentIds === null && enabledSegmentKeys === null && enabledProfileKeys === null) return authority;
  if (authority.source !== "workflow") return authority;
  const intentId = normalizeNullableString(input.classification?.intent);
  if (intentId && enabledIntentIds?.includes(intentId)) return authority;
  const segmentKey = buildAssistantWorkflowToolSelectionSegmentKey({
    intentId: intentId ?? "unknown",
    hop: input.hop ?? null,
    selectedReason: input.selectedReason ?? null,
  });
  if (enabledSegmentKeys?.includes(segmentKey)) return authority;
  const profileKey = comparisonPayload
    ? normalizeNullableString(comparisonPayload["workflowAuthorityProfileKey"])
    : null;
  if (profileKey && enabledProfileKeys?.includes(profileKey)) return authority;

  return {
    ...authority,
    source: "legacy-pruner",
    reason: "workflow_authority_not_enabled",
  };
}

function isWorkflowAuthorityEnabled(
  input: AssistantWorkflowToolSelectionDecisionInput,
  comparisonPayload: Record<string, unknown>,
): boolean {
  const enabledIntentIds = normalizeOptionalStringList(input.workflowAuthorityIntentIds);
  const enabledSegmentKeys = normalizeOptionalStringList(input.workflowAuthoritySegmentKeys);
  const enabledProfileKeys = normalizeOptionalStringList(input.workflowAuthorityProfileKeys);
  if (enabledIntentIds === null && enabledSegmentKeys === null && enabledProfileKeys === null) return false;
  const intentId = normalizeNullableString(input.classification?.intent);
  if (intentId && enabledIntentIds?.includes(intentId)) return true;
  const segmentKey = buildAssistantWorkflowToolSelectionSegmentKey({
    intentId: intentId ?? "unknown",
    hop: input.hop ?? null,
    selectedReason: input.selectedReason ?? null,
  });
  if (enabledSegmentKeys?.includes(segmentKey)) return true;
  const profileKey = normalizeNullableString(comparisonPayload["workflowAuthorityProfileKey"]);
  return profileKey !== null && (enabledProfileKeys?.includes(profileKey) ?? false);
}

function normalizeOptionalStringList(values: readonly unknown[] | null | undefined): string[] | null {
  if (values === null || values === undefined) return null;
  return uniqueStrings(values);
}

function readWorkflowStatus(payload: Record<string, unknown>): string | null {
  const workflowRun = isRecord(payload["workflowRun"]) ? payload["workflowRun"] : null;
  return normalizeNullableString(workflowRun?.["status"]);
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
