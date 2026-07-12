import {
  normalizeAssistantWorkflowId,
  type AssistantWorkflowDefinition,
  type AssistantWorkflowToolCapabilityDefinition,
  type AssistantWorkflowToolCacheability,
  type AssistantWorkflowToolContextRequirement,
  type AssistantWorkflowToolEffect,
  type AssistantWorkflowToolOutputKind,
  type AssistantWorkflowToolProvider,
  type AssistantWorkflowToolRetryClass,
  type AssistantWorkflowToolSideEffectRisk,
} from "./definition.js";

export type AssistantWorkflowToolCapabilityLookup = {
  tools: AssistantWorkflowToolCapabilityDefinition[];
  missingToolCapabilities: string[];
};

export type AssistantWorkflowToolCapabilitySummary = {
  toolCount: number;
  providers: Record<AssistantWorkflowToolProvider, number>;
  effects: Record<AssistantWorkflowToolEffect, number>;
  sideEffectRisks: Record<AssistantWorkflowToolSideEffectRisk, number>;
  cacheability: Record<AssistantWorkflowToolCacheability, number>;
  retryClasses: Record<AssistantWorkflowToolRetryClass, number>;
  outputKinds: Record<AssistantWorkflowToolOutputKind, number>;
  requiredContext: Record<AssistantWorkflowToolContextRequirement, number>;
  requiresConfirmation: string[];
  missingToolCapabilities: string[];
};

export type AssistantWorkflowToolPolicyRecommendation = {
  toolName: string;
  enabledByDefault: boolean;
  assistantVisibleByDefault: boolean;
  schemaAssistantVisibleByDefault: boolean;
  explicitCallAllowedByDefault: boolean;
  confirmationRequired: boolean;
  readOnly: boolean;
  cacheable: boolean;
  retryAllowed: boolean;
  sideEffectRisk: AssistantWorkflowToolSideEffectRisk;
  outputKinds: AssistantWorkflowToolOutputKind[];
  requiredContext: AssistantWorkflowToolContextRequirement[];
};

export function findAssistantWorkflowToolCapability(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
  toolName: unknown,
): AssistantWorkflowToolCapabilityDefinition | null {
  const normalized = normalizeAssistantWorkflowId(toolName);
  if (!normalized) return null;
  return (workflow.tools ?? []).find((tool) => tool.name === normalized) ?? null;
}

export function getAssistantWorkflowToolCapabilities(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
  toolNames: readonly string[],
): AssistantWorkflowToolCapabilityLookup {
  const toolsByName = new Map((workflow.tools ?? []).map((tool) => [tool.name, tool] as const));
  const tools: AssistantWorkflowToolCapabilityDefinition[] = [];
  const missingToolCapabilities: string[] = [];
  const seen = new Set<string>();

  for (const rawName of toolNames) {
    const name = normalizeAssistantWorkflowId(rawName);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const tool = toolsByName.get(name);
    if (tool) {
      tools.push(tool);
    } else {
      missingToolCapabilities.push(name);
    }
  }

  return { tools, missingToolCapabilities };
}

export function summarizeAssistantWorkflowToolCapabilities(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
  toolNames: readonly string[],
): AssistantWorkflowToolCapabilitySummary {
  const lookup = getAssistantWorkflowToolCapabilities(workflow, toolNames);

  return {
    toolCount: lookup.tools.length,
    providers: countBy(lookup.tools, (tool) => [tool.provider]),
    effects: countBy(lookup.tools, (tool) => [tool.effect]),
    sideEffectRisks: countBy(lookup.tools, (tool) => [tool.sideEffectRisk]),
    cacheability: countBy(lookup.tools, (tool) => [tool.cacheability]),
    retryClasses: countBy(lookup.tools, (tool) => [tool.retryClass]),
    outputKinds: countBy(lookup.tools, (tool) => tool.outputKinds),
    requiredContext: countBy(lookup.tools, (tool) => tool.requiredContext ?? []),
    requiresConfirmation: lookup.tools
      .filter((tool) => tool.requiresConfirmation === true)
      .map((tool) => tool.name),
    missingToolCapabilities: lookup.missingToolCapabilities,
  };
}

export function buildAssistantWorkflowToolPolicyRecommendation(
  tool: AssistantWorkflowToolCapabilityDefinition,
): AssistantWorkflowToolPolicyRecommendation {
  const outputKinds = uniqueStrings(tool.outputKinds);
  const requiredContext = uniqueStrings(tool.requiredContext ?? []);
  const isSchemaTool = outputKinds.includes("schema");
  const confirmationRequired =
    tool.requiresConfirmation === true || tool.effect === "write" || tool.sideEffectRisk === "high";

  return {
    toolName: tool.name,
    enabledByDefault: true,
    assistantVisibleByDefault: !isSchemaTool,
    schemaAssistantVisibleByDefault: isSchemaTool,
    explicitCallAllowedByDefault: tool.sideEffectRisk !== "high",
    confirmationRequired,
    readOnly: tool.effect !== "write",
    cacheable: tool.cacheability === "cacheable",
    retryAllowed: tool.retryClass !== "never",
    sideEffectRisk: tool.sideEffectRisk,
    outputKinds,
    requiredContext,
  };
}

export function buildAssistantWorkflowToolPolicyRecommendations(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
  toolNames?: readonly string[],
): AssistantWorkflowToolPolicyRecommendation[] {
  const tools = toolNames
    ? getAssistantWorkflowToolCapabilities(workflow, toolNames).tools
    : [...(workflow.tools ?? [])];
  return tools.map((tool) => buildAssistantWorkflowToolPolicyRecommendation(tool));
}

function countBy<TKey extends string>(
  tools: readonly AssistantWorkflowToolCapabilityDefinition[],
  selectKeys: (tool: AssistantWorkflowToolCapabilityDefinition) => readonly TKey[],
): Record<TKey, number> {
  const out = {} as Record<TKey, number>;
  for (const tool of tools) {
    for (const key of selectKeys(tool)) {
      out[key] = (out[key] ?? 0) + 1;
    }
  }
  return out;
}

function uniqueStrings<TValue extends string>(values: readonly TValue[]): TValue[] {
  const out: TValue[] = [];
  const seen = new Set<TValue>();
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}
