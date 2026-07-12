import type {
  AssistantWorkflowDefinition,
  AssistantWorkflowDirectRouteDefinition,
  AssistantWorkflowIntentDefinition,
  AssistantWorkflowToolCapabilityDefinition,
} from "./definition.js";
import { defineAssistantWorkflow } from "./definition.js";
import {
  buildAssistantWorkflowDefinitionDiff,
  buildAssistantWorkflowDefinitionDiffTracePayload,
  type AssistantWorkflowDefinitionDiff,
} from "./definition-diff.js";
import type {
  AssistantWorkflowTraceReport,
  AssistantWorkflowTraceReportSuggestion,
} from "./trace-report.js";
import type { AssistantWorkflowJsonValue } from "./run-report-json.js";

export type AssistantWorkflowDefinitionTuningAction =
  | "add_intent_tool_hint"
  | "add_direct_route_strategy"
  | "register_tool_capability"
  | "review_tool_selection_policy"
  | "review_clarification_rule"
  | "review_direct_route_strategy"
  | "debug_runtime_error"
  | "promote_eval_case"
  | "review_quality_signal"
  | "review_memory_patch_mapping";

export type AssistantWorkflowDefinitionTuningPatchPreview =
  | {
      kind: "append_intent_tool_hint";
      intentId: string;
      toolName: string;
    }
  | {
      kind: "register_tool_capability";
      toolName: string;
    }
  | {
      kind: "append_direct_route_strategy";
      routeId: string;
      strategyId: string;
      description: string;
    }
  | {
      kind: "none";
    };

export type AssistantWorkflowDefinitionTuningSuggestion = {
  id: string;
  action: AssistantWorkflowDefinitionTuningAction;
  severity: "info" | "warning";
  intentId: string | null;
  toolName: string | null;
  signal: string | null;
  count: number;
  requestIds: string[];
  sourceSuggestionIds: string[];
  rationale: string;
  suggestedAction: string;
  patchPreview: AssistantWorkflowDefinitionTuningPatchPreview;
};

export type AssistantWorkflowDefinitionTuningReportOptions = {
  minCount?: number;
  includeLowConfidence?: boolean;
  ignoredIntentIds?: readonly string[];
};

export type AssistantWorkflowDefinitionTuningReport = {
  generatedAt: string;
  workflowId: string;
  workflowVersion: number;
  sourceSuggestionCount: number;
  suggestionCount: number;
  applicableSuggestionCount: number;
  skippedSuggestionCount: number;
  suggestions: AssistantWorkflowDefinitionTuningSuggestion[];
};

export type AssistantWorkflowDefinitionTuningApplySkipReason =
  | "not_selected"
  | "unsupported_patch"
  | "missing_intent"
  | "missing_direct_route"
  | "tool_hint_exists"
  | "direct_route_strategy_exists"
  | "intent_apply_limit";

export type AssistantWorkflowDefinitionTuningApplySkippedSuggestion = {
  id: string;
  reason: AssistantWorkflowDefinitionTuningApplySkipReason;
};

export type AssistantWorkflowDefinitionTuningApplyOptions = {
  suggestionIds?: readonly string[];
  bumpVersion?: boolean;
  maxToolHintsPerIntent?: number;
};

export type AssistantWorkflowDefinitionTuningApplyResult = {
  changed: boolean;
  appliedCount: number;
  skippedCount: number;
  appliedSuggestionIds: string[];
  skippedSuggestions: AssistantWorkflowDefinitionTuningApplySkippedSuggestion[];
  diff: AssistantWorkflowDefinitionDiff;
  definition: AssistantWorkflowDefinition;
};

type SuggestionAccumulator = Omit<
  AssistantWorkflowDefinitionTuningSuggestion,
  "count" | "requestIds" | "sourceSuggestionIds"
> & {
  count: number;
  requestIds: string[];
  sourceSuggestionIds: string[];
};

export function buildAssistantWorkflowDefinitionTuningReport(
  workflow: AssistantWorkflowDefinition,
  traceReport: AssistantWorkflowTraceReport,
  options: AssistantWorkflowDefinitionTuningReportOptions = {},
): AssistantWorkflowDefinitionTuningReport {
  return buildAssistantWorkflowDefinitionTuningReportFromSuggestions(
    workflow,
    traceReport.suggestions,
    options,
  );
}

export function buildAssistantWorkflowDefinitionTuningReportFromSuggestions(
  workflow: AssistantWorkflowDefinition,
  traceSuggestions: readonly AssistantWorkflowTraceReportSuggestion[],
  options: AssistantWorkflowDefinitionTuningReportOptions = {},
): AssistantWorkflowDefinitionTuningReport {
  const minCount = clampPositiveInteger(options.minCount, 1);
  const includeLowConfidence = options.includeLowConfidence === true;
  const ignoredIntentIds = new Set(options.ignoredIntentIds ?? ["fallback", "other", "unknown"]);
  const builder = new DefinitionTuningSuggestionBuilder(workflow);

  for (const suggestion of traceSuggestions) {
    if (suggestion.count < minCount) continue;
    const tuningSuggestion = mapTraceSuggestionToDefinitionSuggestion(
      workflow,
      suggestion,
      includeLowConfidence,
      ignoredIntentIds,
    );
    if (tuningSuggestion) builder.add(tuningSuggestion);
  }

  const suggestions = builder.toSuggestions();
  return {
    generatedAt: new Date().toISOString(),
    workflowId: workflow.id,
    workflowVersion: workflow.version,
    sourceSuggestionCount: traceSuggestions.length,
    suggestionCount: suggestions.length,
    applicableSuggestionCount: suggestions.filter((suggestion) => suggestion.patchPreview.kind !== "none").length,
    skippedSuggestionCount: traceSuggestions.length - suggestions.length,
    suggestions,
  };
}

export function applyAssistantWorkflowDefinitionTuningSuggestions(
  workflow: AssistantWorkflowDefinition,
  suggestions: readonly AssistantWorkflowDefinitionTuningSuggestion[],
  options: AssistantWorkflowDefinitionTuningApplyOptions = {},
): AssistantWorkflowDefinitionTuningApplyResult {
  const selectedIds = options.suggestionIds ? new Set(options.suggestionIds) : null;
  const maxToolHintsPerIntent = normalizeOptionalPositiveInteger(options.maxToolHintsPerIntent);
  const appliedSuggestionIds: string[] = [];
  const skippedSuggestions: AssistantWorkflowDefinitionTuningApplySkippedSuggestion[] = [];
  const toolHintsByIntent = new Map<string, string[]>();
  const strategiesByDirectRoute = new Map<string, Array<{ id: string; description: string }>>();

  for (const suggestion of suggestions) {
    if (selectedIds && !selectedIds.has(suggestion.id)) {
      skippedSuggestions.push({ id: suggestion.id, reason: "not_selected" });
      continue;
    }
    if (suggestion.patchPreview.kind === "append_intent_tool_hint") {
      const intent = findIntent(workflow, suggestion.patchPreview.intentId);
      if (!intent) {
        skippedSuggestions.push({ id: suggestion.id, reason: "missing_intent" });
        continue;
      }
      if (intentHasToolHint(intent, suggestion.patchPreview.toolName)) {
        skippedSuggestions.push({ id: suggestion.id, reason: "tool_hint_exists" });
        continue;
      }
      const pendingHints = toolHintsByIntent.get(intent.id) ?? [];
      if (pendingHints.includes(suggestion.patchPreview.toolName)) {
        skippedSuggestions.push({ id: suggestion.id, reason: "tool_hint_exists" });
        continue;
      }
      if (maxToolHintsPerIntent !== null && pendingHints.length >= maxToolHintsPerIntent) {
        skippedSuggestions.push({ id: suggestion.id, reason: "intent_apply_limit" });
        continue;
      }
      pendingHints.push(suggestion.patchPreview.toolName);
      toolHintsByIntent.set(intent.id, pendingHints);
      appliedSuggestionIds.push(suggestion.id);
      continue;
    }
    if (suggestion.patchPreview.kind === "append_direct_route_strategy") {
      const patchPreview = suggestion.patchPreview;
      const directRoute = findDirectRoute(workflow, patchPreview.routeId);
      if (!directRoute) {
        skippedSuggestions.push({ id: suggestion.id, reason: "missing_direct_route" });
        continue;
      }
      if (directRouteHasStrategy(directRoute, patchPreview.strategyId)) {
        skippedSuggestions.push({ id: suggestion.id, reason: "direct_route_strategy_exists" });
        continue;
      }
      const pendingStrategies = strategiesByDirectRoute.get(directRoute.id) ?? [];
      if (pendingStrategies.some((strategy) => strategy.id === patchPreview.strategyId)) {
        skippedSuggestions.push({ id: suggestion.id, reason: "direct_route_strategy_exists" });
        continue;
      }
      pendingStrategies.push({
        id: patchPreview.strategyId,
        description: patchPreview.description,
      });
      strategiesByDirectRoute.set(directRoute.id, pendingStrategies);
      appliedSuggestionIds.push(suggestion.id);
      continue;
    }
    {
      skippedSuggestions.push({ id: suggestion.id, reason: "unsupported_patch" });
      continue;
    }
  }

  if (appliedSuggestionIds.length === 0) {
    return {
      changed: false,
      appliedCount: 0,
      skippedCount: skippedSuggestions.length,
      appliedSuggestionIds,
      skippedSuggestions,
      diff: buildAssistantWorkflowDefinitionDiff(workflow, workflow),
      definition: workflow,
    };
  }

  const directRoutes = workflow.directRoutes?.map((directRoute) => {
    const appendedStrategies = strategiesByDirectRoute.get(directRoute.id);
    if (!appendedStrategies?.length) return directRoute;
    return {
      ...directRoute,
      strategies: [
        ...(directRoute.strategies ?? []),
        ...appendedStrategies,
      ],
    };
  });
  const definition = defineAssistantWorkflow({
    ...workflow,
    version: options.bumpVersion === false ? workflow.version : workflow.version + 1,
    intents: workflow.intents.map((intent) => {
      const appendedHints = toolHintsByIntent.get(intent.id);
      if (!appendedHints?.length) return intent;
      return {
        ...intent,
        toolHints: uniqueStrings([
          ...(intent.toolHints ?? []),
          ...appendedHints,
        ]),
      };
    }),
    ...(directRoutes ? { directRoutes } : {}),
  });

  return {
    changed: true,
    appliedCount: appliedSuggestionIds.length,
    skippedCount: skippedSuggestions.length,
    appliedSuggestionIds,
    skippedSuggestions,
    diff: buildAssistantWorkflowDefinitionDiff(workflow, definition),
    definition,
  };
}

export function buildAssistantWorkflowDefinitionTuningApplyTracePayload(
  result: AssistantWorkflowDefinitionTuningApplyResult,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    changed: result.changed,
    appliedCount: result.appliedCount,
    skippedCount: result.skippedCount,
    appliedSuggestionIds: result.appliedSuggestionIds,
    skippedSuggestions: result.skippedSuggestions.map((suggestion) => ({
      id: suggestion.id,
      reason: suggestion.reason,
    })),
    definition: {
      id: result.definition.id,
      version: result.definition.version,
      intentCount: result.definition.intents.length,
      toolCapabilityCount: result.definition.tools?.length ?? 0,
      planningStepCount: result.definition.planningSteps?.length ?? 0,
    },
    diff: buildAssistantWorkflowDefinitionDiffTracePayload(result.diff),
  };
}

function mapTraceSuggestionToDefinitionSuggestion(
  workflow: AssistantWorkflowDefinition,
  suggestion: AssistantWorkflowTraceReportSuggestion,
  includeLowConfidence: boolean,
  ignoredIntentIds: ReadonlySet<string>,
): AssistantWorkflowDefinitionTuningSuggestion | null {
  const intent = findIntent(workflow, suggestion.intent);
  const tool = findTool(workflow, suggestion.tool);
  const ignoredIntent = suggestion.intent ? ignoredIntentIds.has(suggestion.intent) : false;

  switch (suggestion.kind) {
    case "review_unmodeled_selected_tool":
    case "review_classifier_extra_tool": {
      if (!suggestion.intent || !suggestion.tool) return null;
      if (!intent) return reviewOnlySuggestion(suggestion, "review_tool_selection_policy");
      if (ignoredIntent) return reviewOnlySuggestion(suggestion, "review_tool_selection_policy");
      if (!tool) return registerToolSuggestion(suggestion);
      if (intentHasToolHint(intent, suggestion.tool)) {
        return includeLowConfidence
          ? reviewOnlySuggestion(suggestion, "review_tool_selection_policy")
          : null;
      }
      if (tool.requiresConfirmation || tool.effect === "write" || tool.sideEffectRisk === "high") {
        return reviewOnlySuggestion(suggestion, "review_tool_selection_policy");
      }
      return {
        id: buildDefinitionTuningId("add_intent_tool_hint", suggestion.intent, suggestion.tool),
        action: "add_intent_tool_hint",
        severity: suggestion.severity,
        intentId: suggestion.intent,
        toolName: suggestion.tool,
        signal: suggestion.signal,
        count: suggestion.count,
        requestIds: suggestion.requestIds,
        sourceSuggestionIds: [suggestion.id],
        rationale: `Trace review repeatedly selected ${suggestion.tool} for ${suggestion.intent}, but the workflow intent does not hint that tool.`,
        suggestedAction: "Add the tool as an intent toolHint after confirming it is safe for this intent.",
        patchPreview: {
          kind: "append_intent_tool_hint",
          intentId: suggestion.intent,
          toolName: suggestion.tool,
        },
      };
    }
    case "review_missing_required_tool":
      if (!suggestion.tool) return null;
      if (!tool) return registerToolSuggestion(suggestion);
      return reviewOnlySuggestion(suggestion, "review_tool_selection_policy");
    case "review_workflow_tool_selection_gap":
      return includeLowConfidence
        ? reviewOnlySuggestion(suggestion, "review_tool_selection_policy")
        : null;
    case "review_clarification_policy":
      return reviewOnlySuggestion(suggestion, "review_clarification_rule");
    case "review_memory_patch_equivalence":
      return reviewOnlySuggestion(suggestion, "review_memory_patch_mapping");
    case "review_direct_route_strategy":
      return directRouteStrategySuggestion(workflow, suggestion);
    case "review_trace_error":
      return reviewOnlySuggestion(suggestion, "debug_runtime_error");
    case "review_quality_signal":
      return reviewOnlySuggestion(suggestion, "review_quality_signal");
    case "promote_bad_feedback_eval":
      return reviewOnlySuggestion(suggestion, "promote_eval_case");
  }
}

function directRouteStrategySuggestion(
  workflow: AssistantWorkflowDefinition,
  suggestion: AssistantWorkflowTraceReportSuggestion,
): AssistantWorkflowDefinitionTuningSuggestion {
  const parsed = parseDirectRouteStrategySignal(suggestion.signal);
  const route = findDirectRoute(workflow, suggestion.intent) ??
    findDirectRouteByObservedRoute(workflow, parsed?.route ?? null);
  if (!route || !parsed || directRouteHasStrategy(route, parsed.strategy)) {
    return reviewOnlySuggestion(suggestion, "review_direct_route_strategy");
  }
  return {
    id: buildDefinitionTuningId("add_direct_route_strategy", route.id, parsed.strategy),
    action: "add_direct_route_strategy",
    severity: suggestion.severity,
    intentId: route.id,
    toolName: null,
    signal: suggestion.signal,
    count: suggestion.count,
    requestIds: suggestion.requestIds,
    sourceSuggestionIds: [suggestion.id],
    rationale: `Trace review observed runtime strategy ${parsed.strategy} for direct route ${route.id}, but the workflow route does not declare it.`,
    suggestedAction: "Add the observed strategy as direct-route metadata after confirming it names a stable runtime branch.",
    patchPreview: {
      kind: "append_direct_route_strategy",
      routeId: route.id,
      strategyId: parsed.strategy,
      description: `Observed runtime strategy ${parsed.strategy} for direct route ${route.id}.`,
    },
  };
}

function registerToolSuggestion(
  suggestion: AssistantWorkflowTraceReportSuggestion,
): AssistantWorkflowDefinitionTuningSuggestion {
  const toolName = suggestion.tool ?? "unknown";
  return {
    id: buildDefinitionTuningId("register_tool_capability", suggestion.intent, toolName),
    action: "register_tool_capability",
    severity: "warning",
    intentId: suggestion.intent,
    toolName,
    signal: suggestion.signal,
    count: suggestion.count,
    requestIds: suggestion.requestIds,
    sourceSuggestionIds: [suggestion.id],
    rationale: `Trace review referenced ${toolName}, but the workflow package does not define that tool capability.`,
    suggestedAction: "Register the tool capability/binding or remove the stale tool reference from the runtime path.",
    patchPreview: {
      kind: "register_tool_capability",
      toolName,
    },
  };
}

function reviewOnlySuggestion(
  suggestion: AssistantWorkflowTraceReportSuggestion,
  action: AssistantWorkflowDefinitionTuningAction,
): AssistantWorkflowDefinitionTuningSuggestion {
  return {
    id: buildDefinitionTuningId(action, suggestion.intent, suggestion.tool ?? suggestion.signal ?? "all"),
    action,
    severity: suggestion.severity,
    intentId: suggestion.intent,
    toolName: suggestion.tool,
    signal: suggestion.signal,
    count: suggestion.count,
    requestIds: suggestion.requestIds,
    sourceSuggestionIds: [suggestion.id],
    rationale: suggestion.rationale,
    suggestedAction: suggestion.suggestedAction,
    patchPreview: { kind: "none" },
  };
}

class DefinitionTuningSuggestionBuilder {
  private readonly suggestions = new Map<string, SuggestionAccumulator>();

  constructor(private readonly workflow: AssistantWorkflowDefinition) {}

  add(input: AssistantWorkflowDefinitionTuningSuggestion): void {
    const existing = this.suggestions.get(input.id);
    if (existing) {
      existing.count += input.count;
      existing.requestIds = mergeLimitedStrings(existing.requestIds, input.requestIds);
      existing.sourceSuggestionIds = mergeLimitedStrings(existing.sourceSuggestionIds, input.sourceSuggestionIds);
      if (input.severity === "warning") existing.severity = "warning";
      return;
    }
    this.suggestions.set(input.id, {
      id: input.id,
      action: input.action,
      severity: input.severity,
      intentId: input.intentId,
      toolName: input.toolName,
      signal: input.signal,
      count: input.count,
      requestIds: [...input.requestIds],
      sourceSuggestionIds: [...input.sourceSuggestionIds],
      rationale: input.rationale,
      suggestedAction: input.suggestedAction,
      patchPreview: input.patchPreview,
    });
  }

  toSuggestions(): AssistantWorkflowDefinitionTuningSuggestion[] {
    return [...this.suggestions.values()]
      .filter((suggestion) => !isNoopToolHintSuggestion(this.workflow, suggestion))
      .sort((left, right) => {
        if (left.severity !== right.severity) return left.severity === "warning" ? -1 : 1;
        if (right.count !== left.count) return right.count - left.count;
        return left.id.localeCompare(right.id);
      });
  }
}

function isNoopToolHintSuggestion(
  workflow: AssistantWorkflowDefinition,
  suggestion: SuggestionAccumulator,
): boolean {
  if (suggestion.patchPreview.kind === "append_intent_tool_hint") {
    const intent = findIntent(workflow, suggestion.patchPreview.intentId);
    return intentHasToolHint(intent, suggestion.patchPreview.toolName);
  }
  if (suggestion.patchPreview.kind === "append_direct_route_strategy") {
    const directRoute = findDirectRoute(workflow, suggestion.patchPreview.routeId);
    return directRouteHasStrategy(directRoute, suggestion.patchPreview.strategyId);
  }
  return false;
}

function findIntent(
  workflow: AssistantWorkflowDefinition,
  intentId: string | null,
): AssistantWorkflowIntentDefinition | null {
  if (!intentId) return null;
  return workflow.intents.find((intent) => intent.id === intentId) ?? null;
}

function findTool(
  workflow: AssistantWorkflowDefinition,
  toolName: string | null,
): AssistantWorkflowToolCapabilityDefinition | null {
  if (!toolName) return null;
  return workflow.tools?.find((tool) => tool.name === toolName) ?? null;
}

function findDirectRoute(
  workflow: AssistantWorkflowDefinition,
  routeId: string | null,
): AssistantWorkflowDirectRouteDefinition | null {
  if (!routeId) return null;
  return workflow.directRoutes?.find((route) => route.id === routeId) ?? null;
}

function findDirectRouteByObservedRoute(
  workflow: AssistantWorkflowDefinition,
  observedRoute: string | null,
): AssistantWorkflowDirectRouteDefinition | null {
  if (!observedRoute) return null;
  return workflow.directRoutes?.find((route) => route.id === observedRoute || route.outcomeRoute === observedRoute) ?? null;
}

function directRouteHasStrategy(
  directRoute: AssistantWorkflowDirectRouteDefinition | null,
  strategyId: string,
): boolean {
  if (!directRoute) return false;
  return (directRoute.strategies ?? []).some((strategy) => strategy.id === strategyId);
}

function parseDirectRouteStrategySignal(signal: string | null): { route: string; strategy: string } | null {
  if (!signal) return null;
  const separatorIndex = signal.indexOf(":");
  if (separatorIndex <= 0 || separatorIndex >= signal.length - 1) return null;
  const route = signal.slice(0, separatorIndex).trim();
  const strategy = signal.slice(separatorIndex + 1).trim();
  if (!route || !strategy) return null;
  return { route, strategy };
}

function intentHasToolHint(
  intent: AssistantWorkflowIntentDefinition | null,
  toolName: string,
): boolean {
  if (!intent) return false;
  return (intent.toolHints ?? []).includes(toolName) ||
    (intent.requiredToolHints ?? []).includes(toolName);
}

function mergeLimitedStrings(
  left: readonly string[],
  right: readonly string[],
  limit = 10,
): string[] {
  const out: string[] = [];
  for (const value of [...left, ...right]) {
    if (!value.length || out.includes(value)) continue;
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}

function uniqueStrings(values: readonly string[]): string[] {
  const out: string[] = [];
  for (const value of values) {
    if (!value.length || out.includes(value)) continue;
    out.push(value);
  }
  return out;
}

function buildDefinitionTuningId(
  action: AssistantWorkflowDefinitionTuningAction,
  intent: string | null,
  target: string,
): string {
  return [action, intent ?? "unknown", target]
    .map((part) => part.replace(/[^a-zA-Z0-9_.-]+/g, "_").toLowerCase())
    .join(":");
}

function clampPositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value));
}

function normalizeOptionalPositiveInteger(value: number | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(1, Math.floor(value));
}
