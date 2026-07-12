import {
  normalizeAssistantWorkflowId,
  type AssistantWorkflowDefinition,
  type AssistantWorkflowToolBindingDefinition,
  type AssistantWorkflowToolCapabilityDefinition,
} from "./definition.js";
import {
  buildAssistantWorkflowToolPolicyRecommendation,
  type AssistantWorkflowToolPolicyRecommendation,
} from "./tool-capabilities.js";
import {
  resolveAssistantWorkflowTools,
  type AssistantWorkflowToolResolutionStatus,
} from "./tool-bindings.js";

export type AssistantWorkflowToolRuntimeRegistration = {
  name: string;
  enabled: boolean;
  assistantVisible: boolean;
  schemaAssistantVisible: boolean;
  explicitCallAllowed: boolean;
  supportsAssistantVisibility?: boolean;
  supportsSchemaAssistantVisibility?: boolean;
  supportsExplicitCall?: boolean;
  adapterId?: string | null;
};

export type AssistantWorkflowToolRuntimePolicyField =
  | "enabled"
  | "assistantVisible"
  | "schemaAssistantVisible"
  | "explicitCallAllowed";

export type AssistantWorkflowToolRuntimePolicyMismatch = {
  field: AssistantWorkflowToolRuntimePolicyField;
  expected: boolean;
  actual: boolean;
};

export type AssistantWorkflowToolRuntimeResolutionStatus =
  | AssistantWorkflowToolResolutionStatus
  | "missing-runtime-registration"
  | "policy-drift";

export type AssistantWorkflowToolRuntimeResolution = {
  toolName: string;
  status: AssistantWorkflowToolRuntimeResolutionStatus;
  capability: AssistantWorkflowToolCapabilityDefinition | null;
  binding: AssistantWorkflowToolBindingDefinition | null;
  registration: AssistantWorkflowToolRuntimeRegistration | null;
  recommendation: AssistantWorkflowToolPolicyRecommendation | null;
  policyMismatches: AssistantWorkflowToolRuntimePolicyMismatch[];
};

export type AssistantWorkflowToolRuntimeAudit = {
  resolutions: AssistantWorkflowToolRuntimeResolution[];
  registeredToolNames: string[];
  readyToolNames: string[];
  policyDriftToolNames: string[];
  missingRuntimeRegistrationNames: string[];
  runtimeToolWithoutCapabilityNames: string[];
  missingBindingNames: string[];
  providerMismatchNames: string[];
  duplicateRuntimeRegistrationNames: string[];
};

export function resolveAssistantWorkflowToolRuntime(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
  registrations: readonly AssistantWorkflowToolRuntimeRegistration[],
  toolName: unknown,
): AssistantWorkflowToolRuntimeResolution {
  const normalizedToolName = normalizeAssistantWorkflowId(toolName) ?? "";
  const staticResolution = resolveAssistantWorkflowTools(workflow, [normalizedToolName]).resolutions[0] ?? null;
  const registration = findAssistantWorkflowToolRuntimeRegistration(registrations, normalizedToolName);
  const capability = staticResolution?.capability ?? null;
  const binding = staticResolution?.binding ?? null;
  const recommendation = capability
    ? buildAssistantWorkflowToolPolicyRecommendation(capability)
    : null;

  if (!staticResolution) {
    return {
      toolName: normalizedToolName,
      status: "missing-capability",
      capability,
      binding,
      registration,
      recommendation,
      policyMismatches: [],
    };
  }
  if (staticResolution.status !== "ready") {
    return {
      toolName: normalizedToolName,
      status: staticResolution.status,
      capability,
      binding,
      registration,
      recommendation,
      policyMismatches: [],
    };
  }
  if (!registration) {
    return {
      toolName: normalizedToolName,
      status: "missing-runtime-registration",
      capability,
      binding,
      registration: null,
      recommendation,
      policyMismatches: [],
    };
  }

  const policyMismatches = recommendation
    ? buildPolicyMismatches(recommendation, registration)
    : [];
  return {
    toolName: normalizedToolName,
    status: policyMismatches.length ? "policy-drift" : "ready",
    capability,
    binding,
    registration,
    recommendation,
    policyMismatches,
  };
}

export function buildAssistantWorkflowToolRuntimeAudit(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
  registrations: readonly AssistantWorkflowToolRuntimeRegistration[],
): AssistantWorkflowToolRuntimeAudit {
  const normalizedRegistrations = normalizeRuntimeRegistrations(registrations);
  const resolutions = (workflow.tools ?? []).map((tool) =>
    resolveAssistantWorkflowToolRuntime(workflow, normalizedRegistrations.registrations, tool.name),
  );
  const workflowToolNames = new Set((workflow.tools ?? []).map((tool) => tool.name));
  const runtimeToolWithoutCapabilityNames = normalizedRegistrations.registrations
    .map((registration) => registration.name)
    .filter((toolName) => !workflowToolNames.has(toolName));

  return {
    resolutions,
    registeredToolNames: normalizedRegistrations.registrations.map((registration) => registration.name),
    readyToolNames: resolutions
      .filter((resolution) => resolution.status === "ready")
      .map((resolution) => resolution.toolName),
    policyDriftToolNames: resolutions
      .filter((resolution) => resolution.status === "policy-drift")
      .map((resolution) => resolution.toolName),
    missingRuntimeRegistrationNames: (workflow.tools ?? [])
      .map((tool) => tool.name)
      .filter((toolName) => !normalizedRegistrations.registrations.some((registration) => registration.name === toolName)),
    runtimeToolWithoutCapabilityNames,
    missingBindingNames: resolutions
      .filter((resolution) => resolution.status === "missing-binding")
      .map((resolution) => resolution.toolName),
    providerMismatchNames: resolutions
      .filter((resolution) => resolution.status === "provider-mismatch")
      .map((resolution) => resolution.toolName),
    duplicateRuntimeRegistrationNames: normalizedRegistrations.duplicateNames,
  };
}

export function buildAssistantWorkflowToolRuntimeResolutionTracePayload(
  resolution: AssistantWorkflowToolRuntimeResolution,
): Record<string, unknown> {
  return {
    toolName: resolution.toolName,
    status: resolution.status,
    capabilityProvider: resolution.capability?.provider ?? null,
    bindingProvider: resolution.binding?.provider ?? null,
    runtimeAdapterId: resolution.registration?.adapterId ?? null,
    policyMismatches: resolution.policyMismatches,
  };
}

export function buildAssistantWorkflowToolRuntimeAuditTracePayload(
  audit: AssistantWorkflowToolRuntimeAudit,
): Record<string, unknown> {
  return {
    registeredToolCount: audit.registeredToolNames.length,
    readyToolNames: audit.readyToolNames,
    policyDriftToolNames: audit.policyDriftToolNames,
    missingRuntimeRegistrationNames: audit.missingRuntimeRegistrationNames,
    runtimeToolWithoutCapabilityNames: audit.runtimeToolWithoutCapabilityNames,
    missingBindingNames: audit.missingBindingNames,
    providerMismatchNames: audit.providerMismatchNames,
    duplicateRuntimeRegistrationNames: audit.duplicateRuntimeRegistrationNames,
  };
}

function findAssistantWorkflowToolRuntimeRegistration(
  registrations: readonly AssistantWorkflowToolRuntimeRegistration[],
  toolName: string,
): AssistantWorkflowToolRuntimeRegistration | null {
  if (!toolName) return null;
  return normalizeRuntimeRegistrations(registrations).registrations
    .find((registration) => registration.name === toolName) ?? null;
}

function normalizeRuntimeRegistrations(
  registrations: readonly AssistantWorkflowToolRuntimeRegistration[],
): {
  registrations: AssistantWorkflowToolRuntimeRegistration[];
  duplicateNames: string[];
} {
  const normalized: AssistantWorkflowToolRuntimeRegistration[] = [];
  const seen = new Set<string>();
  const duplicateNames: string[] = [];

  for (const registration of registrations) {
    const name = normalizeAssistantWorkflowId(registration.name);
    if (!name) continue;
    if (seen.has(name)) {
      duplicateNames.push(name);
      continue;
    }
    seen.add(name);
    normalized.push({
      name,
      enabled: registration.enabled === true,
      assistantVisible: registration.assistantVisible === true,
      schemaAssistantVisible: registration.schemaAssistantVisible === true,
      explicitCallAllowed: registration.explicitCallAllowed === true,
      supportsAssistantVisibility: registration.supportsAssistantVisibility !== false,
      supportsSchemaAssistantVisibility: registration.supportsSchemaAssistantVisibility !== false,
      supportsExplicitCall: registration.supportsExplicitCall !== false,
      adapterId: normalizeNullableString(registration.adapterId),
    });
  }

  return { registrations: normalized, duplicateNames };
}

function buildPolicyMismatches(
  recommendation: AssistantWorkflowToolPolicyRecommendation,
  registration: AssistantWorkflowToolRuntimeRegistration,
): AssistantWorkflowToolRuntimePolicyMismatch[] {
  const expected: Record<AssistantWorkflowToolRuntimePolicyField, boolean> = {
    enabled: recommendation.enabledByDefault,
    assistantVisible:
      recommendation.assistantVisibleByDefault && registration.supportsAssistantVisibility !== false,
    schemaAssistantVisible:
      recommendation.schemaAssistantVisibleByDefault && registration.supportsSchemaAssistantVisibility !== false,
    explicitCallAllowed:
      recommendation.explicitCallAllowedByDefault && registration.supportsExplicitCall !== false,
  };
  const actual: Record<AssistantWorkflowToolRuntimePolicyField, boolean> = {
    enabled: registration.enabled,
    assistantVisible: registration.assistantVisible,
    schemaAssistantVisible: registration.schemaAssistantVisible,
    explicitCallAllowed: registration.explicitCallAllowed,
  };

  return (Object.keys(expected) as AssistantWorkflowToolRuntimePolicyField[])
    .filter((field) => expected[field] !== actual[field])
    .map((field) => ({ field, expected: expected[field], actual: actual[field] }));
}

function normalizeNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length ? value.trim() : null;
}
