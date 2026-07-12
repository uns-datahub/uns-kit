import {
  normalizeAssistantWorkflowId,
  type AssistantWorkflowDefinition,
  type AssistantWorkflowToolBindingDefinition,
  type AssistantWorkflowToolCapabilityDefinition,
  type AssistantWorkflowToolProvider,
} from "./definition.js";

export type AssistantWorkflowToolBindingLookup = {
  bindings: AssistantWorkflowToolBindingDefinition[];
  missingToolBindings: string[];
};

export type AssistantWorkflowToolBindingCoverage = {
  boundToolNames: string[];
  unboundToolNames: string[];
  bindingWithoutCapabilityNames: string[];
  providerMismatches: AssistantWorkflowToolBindingProviderMismatch[];
};

export type AssistantWorkflowToolBindingProviderMismatch = {
  toolName: string;
  capabilityProvider: AssistantWorkflowToolProvider;
  bindingProvider: AssistantWorkflowToolProvider;
};

export type AssistantWorkflowToolBindingSummary = {
  bindingCount: number;
  providers: Record<AssistantWorkflowToolProvider, number>;
  coverage: AssistantWorkflowToolBindingCoverage;
};

export type AssistantWorkflowToolResolutionStatus =
  | "ready"
  | "missing-capability"
  | "missing-binding"
  | "provider-mismatch";

export type AssistantWorkflowToolResolution = {
  toolName: string;
  status: AssistantWorkflowToolResolutionStatus;
  capability: AssistantWorkflowToolCapabilityDefinition | null;
  binding: AssistantWorkflowToolBindingDefinition | null;
  provider: AssistantWorkflowToolProvider | null;
};

export type AssistantWorkflowToolResolutionSummary = {
  resolutions: AssistantWorkflowToolResolution[];
  readyToolNames: string[];
  missingCapabilityNames: string[];
  missingBindingNames: string[];
  providerMismatchNames: string[];
};

export function findAssistantWorkflowToolBinding(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
  toolName: unknown,
): AssistantWorkflowToolBindingDefinition | null {
  const normalized = normalizeAssistantWorkflowId(toolName);
  if (!normalized) return null;
  return (workflow.toolBindings ?? []).find((binding) => binding.name === normalized) ?? null;
}

export function getAssistantWorkflowToolBindings(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
  toolNames: readonly string[],
): AssistantWorkflowToolBindingLookup {
  const bindingsByName = new Map((workflow.toolBindings ?? []).map((binding) => [binding.name, binding] as const));
  const bindings: AssistantWorkflowToolBindingDefinition[] = [];
  const missingToolBindings: string[] = [];
  const seen = new Set<string>();

  for (const rawName of toolNames) {
    const name = normalizeAssistantWorkflowId(rawName);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const binding = bindingsByName.get(name);
    if (binding) {
      bindings.push(binding);
    } else {
      missingToolBindings.push(name);
    }
  }

  return { bindings, missingToolBindings };
}

export function summarizeAssistantWorkflowToolBindings(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
): AssistantWorkflowToolBindingSummary {
  const bindings = [...(workflow.toolBindings ?? [])];
  return {
    bindingCount: bindings.length,
    providers: countProviders(bindings),
    coverage: buildAssistantWorkflowToolBindingCoverage(workflow),
  };
}

export function resolveAssistantWorkflowTools(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
  toolNames: readonly string[],
): AssistantWorkflowToolResolutionSummary {
  const capabilitiesByName = new Map((workflow.tools ?? []).map((tool) => [tool.name, tool] as const));
  const bindingsByName = new Map((workflow.toolBindings ?? []).map((binding) => [binding.name, binding] as const));
  const resolutions: AssistantWorkflowToolResolution[] = [];
  const seen = new Set<string>();

  for (const rawName of toolNames) {
    const toolName = normalizeAssistantWorkflowId(rawName);
    if (!toolName || seen.has(toolName)) continue;
    seen.add(toolName);
    const capability = capabilitiesByName.get(toolName) ?? null;
    const binding = bindingsByName.get(toolName) ?? null;
    const status = resolveToolStatus(capability, binding);
    resolutions.push({
      toolName,
      status,
      capability,
      binding,
      provider: binding?.provider ?? capability?.provider ?? null,
    });
  }

  return {
    resolutions,
    readyToolNames: resolutions
      .filter((resolution) => resolution.status === "ready")
      .map((resolution) => resolution.toolName),
    missingCapabilityNames: resolutions
      .filter((resolution) => resolution.status === "missing-capability")
      .map((resolution) => resolution.toolName),
    missingBindingNames: resolutions
      .filter((resolution) => resolution.status === "missing-binding")
      .map((resolution) => resolution.toolName),
    providerMismatchNames: resolutions
      .filter((resolution) => resolution.status === "provider-mismatch")
      .map((resolution) => resolution.toolName),
  };
}

export function buildAssistantWorkflowToolBindingCoverage(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
): AssistantWorkflowToolBindingCoverage {
  const capabilitiesByName = new Map((workflow.tools ?? []).map((tool) => [tool.name, tool] as const));
  const bindingsByName = new Map((workflow.toolBindings ?? []).map((binding) => [binding.name, binding] as const));
  const boundToolNames: string[] = [];
  const unboundToolNames: string[] = [];
  const bindingWithoutCapabilityNames: string[] = [];
  const providerMismatches: AssistantWorkflowToolBindingProviderMismatch[] = [];

  for (const tool of workflow.tools ?? []) {
    const binding = bindingsByName.get(tool.name);
    if (binding) {
      boundToolNames.push(tool.name);
      if (binding.provider !== tool.provider) {
        providerMismatches.push({
          toolName: tool.name,
          capabilityProvider: tool.provider,
          bindingProvider: binding.provider,
        });
      }
    } else {
      unboundToolNames.push(tool.name);
    }
  }

  for (const binding of workflow.toolBindings ?? []) {
    if (!capabilitiesByName.has(binding.name)) {
      bindingWithoutCapabilityNames.push(binding.name);
    }
  }

  return {
    boundToolNames,
    unboundToolNames,
    bindingWithoutCapabilityNames,
    providerMismatches,
  };
}

function countProviders(
  bindings: readonly AssistantWorkflowToolBindingDefinition[],
): Record<AssistantWorkflowToolProvider, number> {
  const out = {} as Record<AssistantWorkflowToolProvider, number>;
  for (const binding of bindings) {
    out[binding.provider] = (out[binding.provider] ?? 0) + 1;
  }
  return out;
}

function resolveToolStatus(
  capability: AssistantWorkflowToolCapabilityDefinition | null,
  binding: AssistantWorkflowToolBindingDefinition | null,
): AssistantWorkflowToolResolutionStatus {
  if (!capability) return "missing-capability";
  if (!binding) return "missing-binding";
  if (capability.provider !== binding.provider) return "provider-mismatch";
  return "ready";
}
