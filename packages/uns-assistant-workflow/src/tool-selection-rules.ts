export type AssistantWorkflowToolSelectionSignalState<TSignal extends string = string> =
  Partial<Record<TSignal, boolean>>;

export type AssistantWorkflowToolSelectionRuleCondition<TSignal extends string = string> = {
  allSignals?: readonly TSignal[];
  anySignals?: readonly TSignal[];
  notSignals?: readonly TSignal[];
  minHop?: number;
  maxHop?: number;
  enabled?: boolean;
};

export type AssistantWorkflowToolSelectionRule<TSignal extends string = string> = {
  id: string;
  toolNames: readonly string[];
  condition?: AssistantWorkflowToolSelectionRuleCondition<TSignal>;
  terminal?: boolean;
  terminalReason?: string;
};

export type AssistantWorkflowRuleBasedToolSelectionReasons = {
  noTools?: string;
  disabled?: string;
  emptySelection?: string;
  selected?: string;
};

export type AssistantWorkflowRuleBasedToolSelectionInput<TTool, TSignal extends string = string> = {
  allTools: readonly TTool[];
  pruningEnabled: boolean;
  hop?: number | null;
  signals?: AssistantWorkflowToolSelectionSignalState<TSignal> | null;
  classifierSuggestedToolNames?: readonly string[] | null;
  rules?: readonly AssistantWorkflowToolSelectionRule<TSignal>[] | null;
  fallbackToolNames?: readonly string[] | null;
  postFallbackRules?: readonly AssistantWorkflowToolSelectionRule<TSignal>[] | null;
  getToolName?: (tool: TTool) => string | null | undefined;
  estimateToolCost?: (tool: TTool) => number;
  reasons?: AssistantWorkflowRuleBasedToolSelectionReasons;
};

export type AssistantWorkflowRuleBasedToolSelectionResult<TTool> = {
  tools: TTool[];
  mode: "full" | "pruned";
  reason: string;
  approxSchemaChars: number;
  toolNames: string[];
  appliedRuleIds: string[];
};

export function estimateAssistantWorkflowToolSchemaChars<TTool>(
  tools: readonly TTool[],
  estimateToolCost: (tool: TTool) => number = estimateDefaultToolCost,
): number {
  let total = 0;
  for (const tool of tools) total += estimateToolCost(tool);
  return total;
}

export function selectAssistantWorkflowToolsByRules<TTool, TSignal extends string = string>(
  input: AssistantWorkflowRuleBasedToolSelectionInput<TTool, TSignal>,
): AssistantWorkflowRuleBasedToolSelectionResult<TTool> {
  const reasons = {
    noTools: input.reasons?.noTools ?? "no_tools",
    disabled: input.reasons?.disabled ?? "disabled",
    emptySelection: input.reasons?.emptySelection ?? "empty_selection",
    selected: input.reasons?.selected ?? "intent_pruned",
  };
  const getToolName = input.getToolName ?? defaultGetToolName;
  const estimateToolCost = input.estimateToolCost ?? estimateDefaultToolCost;
  const allTools = [...input.allTools];

  if (!allTools.length) {
    return {
      tools: [],
      mode: "full",
      reason: reasons.noTools,
      approxSchemaChars: 0,
      toolNames: [],
      appliedRuleIds: [],
    };
  }

  if (!input.pruningEnabled) {
    return {
      tools: allTools,
      mode: "full",
      reason: reasons.disabled,
      approxSchemaChars: estimateAssistantWorkflowToolSchemaChars(allTools, estimateToolCost),
      toolNames: allTools.map((tool) => normalizeToolName(getToolName(tool)) || "unknown"),
      appliedRuleIds: [],
    };
  }

  const selectedNames = new Set<string>();
  const appliedRuleIds: string[] = [];
  addToolNames(selectedNames, input.classifierSuggestedToolNames ?? []);
  if ((input.classifierSuggestedToolNames ?? []).length > 0) {
    appliedRuleIds.push("classifier_suggested");
  }

  const terminal = applyRules({
    selectedNames,
    appliedRuleIds,
    rules: input.rules ?? [],
    signals: input.signals ?? {},
    hop: input.hop ?? null,
    allTools,
    getToolName,
    estimateToolCost,
  });
  if (terminal) return terminal;

  if (selectedNames.size === 0 && (input.fallbackToolNames ?? []).length > 0) {
    addToolNames(selectedNames, input.fallbackToolNames ?? []);
    appliedRuleIds.push("fallback");
  }

  const postFallbackTerminal = applyRules({
    selectedNames,
    appliedRuleIds,
    rules: input.postFallbackRules ?? [],
    signals: input.signals ?? {},
    hop: input.hop ?? null,
    allTools,
    getToolName,
    estimateToolCost,
  });
  if (postFallbackTerminal) return postFallbackTerminal;

  const selected = filterSelectedTools(allTools, selectedNames, getToolName);
  if (!selected.tools.length) {
    return {
      tools: allTools,
      mode: "full",
      reason: reasons.emptySelection,
      approxSchemaChars: estimateAssistantWorkflowToolSchemaChars(allTools, estimateToolCost),
      toolNames: allTools.map((tool) => normalizeToolName(getToolName(tool)) || "unknown"),
      appliedRuleIds,
    };
  }

  return {
    tools: selected.tools,
    mode: "pruned",
    reason: reasons.selected,
    approxSchemaChars: estimateAssistantWorkflowToolSchemaChars(selected.tools, estimateToolCost),
    toolNames: selected.toolNames,
    appliedRuleIds,
  };
}

function applyRules<TTool, TSignal extends string>(input: {
  selectedNames: Set<string>;
  appliedRuleIds: string[];
  rules: readonly AssistantWorkflowToolSelectionRule<TSignal>[];
  signals: AssistantWorkflowToolSelectionSignalState<TSignal>;
  hop: number | null;
  allTools: readonly TTool[];
  getToolName: (tool: TTool) => string | null | undefined;
  estimateToolCost: (tool: TTool) => number;
}): AssistantWorkflowRuleBasedToolSelectionResult<TTool> | null {
  for (const rule of input.rules) {
    if (!ruleMatches(rule.condition, input.signals, input.hop)) continue;
    addToolNames(input.selectedNames, rule.toolNames);
    input.appliedRuleIds.push(rule.id);
    if (rule.terminal) {
      const selected = filterSelectedTools(input.allTools, input.selectedNames, input.getToolName);
      if (!selected.tools.length) continue;
      return {
        tools: selected.tools,
        mode: "pruned",
        reason: rule.terminalReason ?? rule.id,
        approxSchemaChars: estimateAssistantWorkflowToolSchemaChars(selected.tools, input.estimateToolCost),
        toolNames: selected.toolNames,
        appliedRuleIds: [...input.appliedRuleIds],
      };
    }
  }
  return null;
}

function ruleMatches<TSignal extends string>(
  condition: AssistantWorkflowToolSelectionRuleCondition<TSignal> | undefined,
  signals: AssistantWorkflowToolSelectionSignalState<TSignal>,
  hop: number | null,
): boolean {
  if (!condition) return true;
  if (condition.enabled === false) return false;
  if (condition.minHop !== undefined && (hop === null || hop < condition.minHop)) return false;
  if (condition.maxHop !== undefined && (hop === null || hop > condition.maxHop)) return false;
  if ((condition.allSignals ?? []).some((signal) => signals[signal] !== true)) return false;
  if ((condition.anySignals ?? []).length > 0 && !(condition.anySignals ?? []).some((signal) => signals[signal] === true)) {
    return false;
  }
  if ((condition.notSignals ?? []).some((signal) => signals[signal] === true)) return false;
  return true;
}

function filterSelectedTools<TTool>(
  tools: readonly TTool[],
  selectedNames: ReadonlySet<string>,
  getToolName: (tool: TTool) => string | null | undefined,
): { tools: TTool[]; toolNames: string[] } {
  const selectedTools: TTool[] = [];
  const toolNames: string[] = [];
  for (const tool of tools) {
    const name = normalizeToolName(getToolName(tool));
    if (!name || !selectedNames.has(name)) continue;
    selectedTools.push(tool);
    toolNames.push(name);
  }
  return { tools: selectedTools, toolNames };
}

function addToolNames(target: Set<string>, toolNames: readonly string[]): void {
  for (const toolName of toolNames) {
    const normalized = normalizeToolName(toolName);
    if (normalized) target.add(normalized);
  }
}

function defaultGetToolName<TTool>(tool: TTool): string | null {
  if (!isRecord(tool)) return null;
  const functionDefinition = tool["function"];
  if (isRecord(functionDefinition) && typeof functionDefinition["name"] === "string") {
    return functionDefinition["name"];
  }
  if (typeof tool["name"] === "string") return tool["name"];
  return null;
}

function estimateDefaultToolCost<TTool>(tool: TTool): number {
  if (!isRecord(tool)) return 0;
  const functionDefinition = tool["function"];
  if (isRecord(functionDefinition)) {
    const name = typeof functionDefinition["name"] === "string" ? functionDefinition["name"] : "";
    const description = typeof functionDefinition["description"] === "string" ? functionDefinition["description"] : "";
    const parameters = functionDefinition["parameters"] ?? {};
    return name.length + description.length + JSON.stringify(parameters).length;
  }
  const name = typeof tool["name"] === "string" ? tool["name"] : "";
  return name.length + JSON.stringify(tool).length;
}

function normalizeToolName(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
