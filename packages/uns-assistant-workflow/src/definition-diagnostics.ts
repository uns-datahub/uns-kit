import {
  normalizeAssistantWorkflowId,
  type AssistantWorkflowClarificationRuleDefinition,
  type AssistantWorkflowDefinition,
  type AssistantWorkflowDirectRouteDefinition,
  type AssistantWorkflowMemorySlotDefinition,
  type AssistantWorkflowPlanningStepDefinition,
  type AssistantWorkflowToolBindingDefinition,
  type AssistantWorkflowToolCapabilityDefinition,
  type AssistantWorkflowVocabularyItem,
} from "./definition.js";

export type AssistantWorkflowDefinitionDiagnosticSeverity = "error" | "warning";

export type AssistantWorkflowDefinitionDiagnosticCode =
  | "missing_workflow_id"
  | "invalid_workflow_version"
  | "missing_intents"
  | "missing_id"
  | "unnormalized_id"
  | "duplicate_id"
  | "missing_description"
  | "missing_tool_hints"
  | "missing_tool_output_kinds"
  | "missing_binding_field"
  | "invalid_http_method"
  | "invalid_tool_selection_profile_condition"
  | "invalid_planning_step_profile_condition"
  | "missing_repl_target"
  | "unknown_tool_capability"
  | "tool_provider_mismatch"
  | "unknown_presentation"
  | "unknown_memory_slot"
  | "unknown_planning_step"
  | "unknown_clarification_rule"
  | "invalid_confidence_threshold"
  | "unbound_tool_capability"
  | "binding_without_capability";

export type AssistantWorkflowDefinitionDiagnostic = {
  severity: AssistantWorkflowDefinitionDiagnosticSeverity;
  code: AssistantWorkflowDefinitionDiagnosticCode;
  path: string;
  message: string;
};

export type AssistantWorkflowDefinitionValidationResult = {
  valid: boolean;
  errorCount: number;
  warningCount: number;
  diagnostics: AssistantWorkflowDefinitionDiagnostic[];
};

export function validateAssistantWorkflowDefinition(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
): AssistantWorkflowDefinitionValidationResult {
  const diagnostics: AssistantWorkflowDefinitionDiagnostic[] = [];

  validateHeader(workflow, diagnostics);
  validateVocabulary("intent", "intents", workflow.intents, diagnostics);
  validateVocabulary("subintent", "subintents", workflow.subintents ?? [], diagnostics);
  validateVocabulary("presentation", "presentations", workflow.presentations ?? [], diagnostics);
  validateVocabulary("derived transform", "derivedTransforms", workflow.derivedTransforms ?? [], diagnostics);
  validateToolCapabilities(workflow.tools ?? [], diagnostics);
  validateToolBindings(workflow.toolBindings ?? [], diagnostics);
  validateMemorySlots(workflow.memorySlots ?? [], diagnostics);
  validatePlanningSteps(workflow.planningSteps ?? [], diagnostics);
  validateClarificationRules(workflow.clarificationRules ?? [], diagnostics);
  validateDirectRoutes(workflow.directRoutes ?? [], diagnostics);
  validateReferences(workflow, diagnostics);

  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const warningCount = diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;
  return {
    valid: errorCount === 0,
    errorCount,
    warningCount,
    diagnostics,
  };
}

function validateHeader(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
  diagnostics: AssistantWorkflowDefinitionDiagnostic[],
): void {
  if (!workflow.id.trim().length) {
    addDiagnostic(diagnostics, "error", "missing_workflow_id", "id", "Assistant workflow id is required.");
  }
  if (!Number.isInteger(workflow.version) || workflow.version < 1) {
    addDiagnostic(diagnostics, "error", "invalid_workflow_version", "version", "Assistant workflow version must be a positive integer.");
  }
  if (!workflow.intents.length) {
    addDiagnostic(diagnostics, "error", "missing_intents", "intents", "Assistant workflow must define at least one intent.");
  }
}

function validateVocabulary(
  kind: string,
  path: string,
  items: readonly AssistantWorkflowVocabularyItem[],
  diagnostics: AssistantWorkflowDefinitionDiagnostic[],
): void {
  const seen = new Map<string, number>();
  for (const [index, item] of items.entries()) {
    const itemPath = `${path}[${index}]`;
    const normalized = normalizeAssistantWorkflowId(item.id);
    if (!normalized) {
      addDiagnostic(diagnostics, "error", "missing_id", `${itemPath}.id`, `Assistant workflow ${kind} id is required.`);
      continue;
    }
    if (normalized !== item.id) {
      addDiagnostic(diagnostics, "error", "unnormalized_id", `${itemPath}.id`, `Assistant workflow ${kind} id must already be normalized: ${item.id}.`);
    }
    const firstIndex = seen.get(normalized);
    if (firstIndex !== undefined) {
      addDiagnostic(diagnostics, "error", "duplicate_id", `${itemPath}.id`, `Duplicate assistant workflow ${kind} id: ${normalized}; first seen at ${path}[${firstIndex}].`);
    } else {
      seen.set(normalized, index);
    }
    if (!item.description.trim().length) {
      addDiagnostic(diagnostics, "error", "missing_description", `${itemPath}.description`, `Assistant workflow ${kind} ${normalized} description is required.`);
    }
  }
}

function validateToolCapabilities(
  tools: readonly AssistantWorkflowToolCapabilityDefinition[],
  diagnostics: AssistantWorkflowDefinitionDiagnostic[],
): void {
  const seen = new Map<string, number>();
  for (const [index, tool] of tools.entries()) {
    const path = `tools[${index}]`;
    const normalized = normalizeAssistantWorkflowId(tool.name);
    if (!normalized) {
      addDiagnostic(diagnostics, "error", "missing_id", `${path}.name`, "Assistant workflow tool capability name is required.");
      continue;
    }
    if (normalized !== tool.name) {
      addDiagnostic(diagnostics, "error", "unnormalized_id", `${path}.name`, `Assistant workflow tool capability name must already be normalized: ${tool.name}.`);
    }
    const firstIndex = seen.get(normalized);
    if (firstIndex !== undefined) {
      addDiagnostic(diagnostics, "error", "duplicate_id", `${path}.name`, `Duplicate assistant workflow tool capability: ${normalized}; first seen at tools[${firstIndex}].`);
    } else {
      seen.set(normalized, index);
    }
    if (!tool.outputKinds.length) {
      addDiagnostic(diagnostics, "error", "missing_tool_output_kinds", `${path}.outputKinds`, `Assistant workflow tool capability ${normalized} must define at least one output kind.`);
    }
  }
}

function validateToolBindings(
  bindings: readonly AssistantWorkflowToolBindingDefinition[],
  diagnostics: AssistantWorkflowDefinitionDiagnostic[],
): void {
  const seen = new Map<string, number>();
  for (const [index, binding] of bindings.entries()) {
    const path = `toolBindings[${index}]`;
    const normalized = normalizeAssistantWorkflowId(binding.name);
    if (!normalized) {
      addDiagnostic(diagnostics, "error", "missing_id", `${path}.name`, "Assistant workflow tool binding name is required.");
      continue;
    }
    if (normalized !== binding.name) {
      addDiagnostic(diagnostics, "error", "unnormalized_id", `${path}.name`, `Assistant workflow tool binding name must already be normalized: ${binding.name}.`);
    }
    const firstIndex = seen.get(normalized);
    if (firstIndex !== undefined) {
      addDiagnostic(diagnostics, "error", "duplicate_id", `${path}.name`, `Duplicate assistant workflow tool binding: ${normalized}; first seen at toolBindings[${firstIndex}].`);
    } else {
      seen.set(normalized, index);
    }
    validateToolBindingTarget(binding, path, diagnostics);
  }
}

function validateToolBindingTarget(
  binding: AssistantWorkflowToolBindingDefinition,
  path: string,
  diagnostics: AssistantWorkflowDefinitionDiagnostic[],
): void {
  switch (binding.provider) {
    case "local-function":
      validateRequiredField(binding.handlerId, `${path}.handlerId`, binding.name, "handlerId", diagnostics);
      return;
    case "http":
      validateRequiredField(binding.path, `${path}.path`, binding.name, "path", diagnostics);
      if (binding.method !== undefined && binding.method !== binding.method.toUpperCase()) {
        addDiagnostic(diagnostics, "error", "invalid_http_method", `${path}.method`, `Assistant workflow tool binding ${binding.name} HTTP method must be uppercase.`);
      }
      return;
    case "openai-hosted":
      validateRequiredField(binding.hostedToolType, `${path}.hostedToolType`, binding.name, "hostedToolType", diagnostics);
      return;
    case "mcp":
      validateRequiredField(binding.serverId, `${path}.serverId`, binding.name, "serverId", diagnostics);
      validateRequiredField(binding.toolName, `${path}.toolName`, binding.name, "toolName", diagnostics);
      return;
    case "repl":
      validateRequiredField(binding.runtimeId, `${path}.runtimeId`, binding.name, "runtimeId", diagnostics);
      if (!binding.functionName?.trim().length && !binding.commandTemplate?.trim().length) {
        addDiagnostic(diagnostics, "error", "missing_repl_target", path, `Assistant workflow tool binding ${binding.name} must define functionName or commandTemplate.`);
      }
      return;
  }
}

function validateRequiredField(
  value: string,
  path: string,
  toolName: string,
  fieldName: string,
  diagnostics: AssistantWorkflowDefinitionDiagnostic[],
): void {
  if (!value.trim().length) {
    addDiagnostic(diagnostics, "error", "missing_binding_field", path, `Assistant workflow tool binding ${toolName} ${fieldName} is required.`);
  }
}

function validateMemorySlots(
  slots: readonly AssistantWorkflowMemorySlotDefinition[],
  diagnostics: AssistantWorkflowDefinitionDiagnostic[],
): void {
  validateVocabulary("memory slot", "memorySlots", slots, diagnostics);
}

function validatePlanningSteps(
  steps: readonly AssistantWorkflowPlanningStepDefinition[],
  diagnostics: AssistantWorkflowDefinitionDiagnostic[],
): void {
  validateVocabulary("planning step", "planningSteps", steps, diagnostics);
}

function validateClarificationRules(
  rules: readonly AssistantWorkflowClarificationRuleDefinition[],
  diagnostics: AssistantWorkflowDefinitionDiagnostic[],
): void {
  validateVocabulary("clarification rule", "clarificationRules", rules, diagnostics);
  for (const [index, rule] of rules.entries()) {
    if (
      rule.condition === "low_confidence" &&
      rule.confidenceBelow !== undefined &&
      (!Number.isFinite(rule.confidenceBelow) || rule.confidenceBelow < 0 || rule.confidenceBelow > 1)
    ) {
      addDiagnostic(diagnostics, "error", "invalid_confidence_threshold", `clarificationRules[${index}].confidenceBelow`, `Assistant workflow clarification rule ${rule.id} confidenceBelow must be between 0 and 1.`);
    }
  }
}

function validateDirectRoutes(
  routes: readonly AssistantWorkflowDirectRouteDefinition[],
  diagnostics: AssistantWorkflowDefinitionDiagnostic[],
): void {
  validateVocabulary("direct route", "directRoutes", routes, diagnostics);
  for (const [routeIndex, route] of routes.entries()) {
    validateVocabulary(
      `direct route ${route.id} strategy`,
      `directRoutes[${routeIndex}].strategies`,
      route.strategies ?? [],
      diagnostics,
    );
  }
}

function validateReferences(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
  diagnostics: AssistantWorkflowDefinitionDiagnostic[],
): void {
  const toolCapabilities = new Map((workflow.tools ?? []).map((tool) => [tool.name, tool] as const));
  const toolBindings = new Map((workflow.toolBindings ?? []).map((binding) => [binding.name, binding] as const));
  const toolNames = new Set(toolCapabilities.keys());
  const presentationIds = new Set((workflow.presentations ?? []).map((presentation) => presentation.id));
  const subintentIds = new Set((workflow.subintents ?? []).map((subintent) => subintent.id));
  const memorySlotIds = new Set((workflow.memorySlots ?? []).map((slot) => slot.id));
  const planningStepIds = new Set((workflow.planningSteps ?? []).map((step) => step.id));
  const clarificationRuleIds = new Set((workflow.clarificationRules ?? []).map((rule) => rule.id));

  for (const [index, binding] of (workflow.toolBindings ?? []).entries()) {
    const capability = toolCapabilities.get(binding.name);
    if (toolCapabilities.size > 0 && !capability) {
      addDiagnostic(diagnostics, "error", "binding_without_capability", `toolBindings[${index}].name`, `Assistant workflow tool binding references unknown tool capability: ${binding.name}.`);
    }
    if (capability && capability.provider !== binding.provider) {
      addDiagnostic(diagnostics, "error", "tool_provider_mismatch", `toolBindings[${index}].provider`, `Assistant workflow tool binding ${binding.name} provider ${binding.provider} does not match capability provider ${capability.provider}.`);
    }
  }
  for (const [index, tool] of (workflow.tools ?? []).entries()) {
    if (!toolBindings.has(tool.name)) {
      addDiagnostic(diagnostics, "warning", "unbound_tool_capability", `tools[${index}].name`, `Assistant workflow tool capability ${tool.name} has no binding.`);
    }
  }

  for (const [index, step] of (workflow.planningSteps ?? []).entries()) {
    for (const toolName of [...(step.toolHints ?? []), ...(step.requiredToolHints ?? [])]) {
      if (toolNames.size > 0 && !toolNames.has(toolName)) {
        addDiagnostic(diagnostics, "error", "unknown_tool_capability", `planningSteps[${index}].toolHints`, `Assistant workflow planning step ${step.id} references unknown tool capability: ${toolName}.`);
      }
    }
    for (const slotId of [...(step.readsMemory ?? []), ...(step.writesMemory ?? [])]) {
      if (memorySlotIds.size > 0 && !memorySlotIds.has(slotId)) {
        addDiagnostic(diagnostics, "error", "unknown_memory_slot", `planningSteps[${index}].readsMemory`, `Assistant workflow planning step ${step.id} references unknown memory slot: ${slotId}.`);
      }
    }
  }

  for (const [index, rule] of (workflow.clarificationRules ?? []).entries()) {
    for (const slotId of [...(rule.readsMemory ?? []), ...(rule.writesMemory ?? [])]) {
      if (memorySlotIds.size > 0 && !memorySlotIds.has(slotId)) {
        addDiagnostic(diagnostics, "error", "unknown_memory_slot", `clarificationRules[${index}].readsMemory`, `Assistant workflow clarification rule ${rule.id} references unknown memory slot: ${slotId}.`);
      }
    }
  }

  for (const [index, intent] of workflow.intents.entries()) {
    validateIntentToolSelectionProfiles(intent, index, toolNames, subintentIds, diagnostics);
    validateIntentPlanningStepProfiles(intent, index, planningStepIds, toolNames, subintentIds, presentationIds, diagnostics);
    if (intent.defaultPresentation && !presentationIds.has(intent.defaultPresentation)) {
      addDiagnostic(diagnostics, "error", "unknown_presentation", `intents[${index}].defaultPresentation`, `Assistant workflow intent ${intent.id} references unknown presentation: ${intent.defaultPresentation}.`);
    }
    for (const toolName of [...(intent.toolHints ?? []), ...(intent.requiredToolHints ?? [])]) {
      if (toolNames.size > 0 && !toolNames.has(toolName)) {
        addDiagnostic(diagnostics, "error", "unknown_tool_capability", `intents[${index}].toolHints`, `Assistant workflow intent ${intent.id} references unknown tool capability: ${toolName}.`);
      }
    }
    for (const slotId of [
      ...(intent.memoryPolicy?.read ?? []),
      ...(intent.memoryPolicy?.write ?? []),
      ...(intent.memoryPolicy?.inject ?? []),
    ]) {
      if (memorySlotIds.size > 0 && !memorySlotIds.has(slotId)) {
        addDiagnostic(diagnostics, "error", "unknown_memory_slot", `intents[${index}].memoryPolicy`, `Assistant workflow intent ${intent.id} references unknown memory slot: ${slotId}.`);
      }
    }
    for (const stepId of intent.planningSteps ?? []) {
      if (planningStepIds.size > 0 && !planningStepIds.has(stepId)) {
        addDiagnostic(diagnostics, "error", "unknown_planning_step", `intents[${index}].planningSteps`, `Assistant workflow intent ${intent.id} references unknown planning step: ${stepId}.`);
      }
    }
    for (const ruleId of intent.clarificationRules ?? []) {
      if (clarificationRuleIds.size > 0 && !clarificationRuleIds.has(ruleId)) {
        addDiagnostic(diagnostics, "error", "unknown_clarification_rule", `intents[${index}].clarificationRules`, `Assistant workflow intent ${intent.id} references unknown clarification rule: ${ruleId}.`);
      }
    }
  }
}

function validateIntentPlanningStepProfiles(
  intent: AssistantWorkflowDefinition<string, string, string, string>["intents"][number],
  intentIndex: number,
  planningStepIds: ReadonlySet<string>,
  toolNames: ReadonlySet<string>,
  subintentIds: ReadonlySet<string>,
  presentationIds: ReadonlySet<string>,
  diagnostics: AssistantWorkflowDefinitionDiagnostic[],
): void {
  const seen = new Map<string, number>();
  for (const [profileIndex, profile] of (intent.planningStepProfiles ?? []).entries()) {
    const profilePath = `intents[${intentIndex}].planningStepProfiles[${profileIndex}]`;
    const normalized = normalizeAssistantWorkflowId(profile.id);
    if (!normalized) {
      addDiagnostic(diagnostics, "error", "missing_id", `${profilePath}.id`, `Assistant workflow intent ${intent.id} planning step profile id is required.`);
      continue;
    }
    if (normalized !== profile.id) {
      addDiagnostic(diagnostics, "error", "unnormalized_id", `${profilePath}.id`, `Assistant workflow intent ${intent.id} planning step profile id must already be normalized: ${profile.id}.`);
    }
    const firstIndex = seen.get(normalized);
    if (firstIndex !== undefined) {
      addDiagnostic(diagnostics, "error", "duplicate_id", `${profilePath}.id`, `Duplicate assistant workflow intent ${intent.id} planning step profile: ${normalized}; first seen at intents[${intentIndex}].planningStepProfiles[${firstIndex}].`);
    } else {
      seen.set(normalized, profileIndex);
    }
    if (!profile.description.trim().length) {
      addDiagnostic(diagnostics, "error", "missing_description", `${profilePath}.description`, `Assistant workflow intent ${intent.id} planning step profile ${normalized} description is required.`);
    }
    if (!profile.planningSteps.length) {
      addDiagnostic(diagnostics, "error", "unknown_planning_step", `${profilePath}.planningSteps`, `Assistant workflow intent ${intent.id} planning step profile ${normalized} must define at least one planning step.`);
    }
    for (const stepId of profile.planningSteps) {
      if (planningStepIds.size > 0 && !planningStepIds.has(stepId)) {
        addDiagnostic(diagnostics, "error", "unknown_planning_step", `${profilePath}.planningSteps`, `Assistant workflow intent ${intent.id} planning step profile ${normalized} references unknown planning step: ${stepId}.`);
      }
    }
    for (const toolName of profile.condition?.requiredTools ?? []) {
      if (toolNames.size > 0 && !toolNames.has(toolName)) {
        addDiagnostic(diagnostics, "error", "unknown_tool_capability", `${profilePath}.condition.requiredTools`, `Assistant workflow intent ${intent.id} planning step profile ${normalized} references unknown required tool: ${toolName}.`);
      }
    }
    const condition = profile.condition;
    if (condition?.subintent && subintentIds.size > 0 && !subintentIds.has(condition.subintent)) {
      addDiagnostic(diagnostics, "error", "missing_id", `${profilePath}.condition.subintent`, `Assistant workflow intent ${intent.id} planning step profile ${normalized} references unknown subintent: ${condition.subintent}.`);
    }
    if (condition?.presentation && presentationIds.size > 0 && !presentationIds.has(condition.presentation)) {
      addDiagnostic(diagnostics, "error", "unknown_presentation", `${profilePath}.condition.presentation`, `Assistant workflow intent ${intent.id} planning step profile ${normalized} references unknown presentation: ${condition.presentation}.`);
    }
    validatePlanningStepProfileCondition(intent.id, profile, profilePath, diagnostics);
  }
}

function validateIntentToolSelectionProfiles(
  intent: AssistantWorkflowDefinition<string, string, string, string>["intents"][number],
  intentIndex: number,
  toolNames: ReadonlySet<string>,
  subintentIds: ReadonlySet<string>,
  diagnostics: AssistantWorkflowDefinitionDiagnostic[],
): void {
  const seen = new Map<string, number>();
  for (const [profileIndex, profile] of (intent.toolSelectionProfiles ?? []).entries()) {
    const profilePath = `intents[${intentIndex}].toolSelectionProfiles[${profileIndex}]`;
    const normalized = normalizeAssistantWorkflowId(profile.id);
    if (!normalized) {
      addDiagnostic(diagnostics, "error", "missing_id", `${profilePath}.id`, `Assistant workflow intent ${intent.id} tool selection profile id is required.`);
      continue;
    }
    if (normalized !== profile.id) {
      addDiagnostic(diagnostics, "error", "unnormalized_id", `${profilePath}.id`, `Assistant workflow intent ${intent.id} tool selection profile id must already be normalized: ${profile.id}.`);
    }
    const firstIndex = seen.get(normalized);
    if (firstIndex !== undefined) {
      addDiagnostic(diagnostics, "error", "duplicate_id", `${profilePath}.id`, `Duplicate assistant workflow intent ${intent.id} tool selection profile: ${normalized}; first seen at intents[${intentIndex}].toolSelectionProfiles[${firstIndex}].`);
    } else {
      seen.set(normalized, profileIndex);
    }
    if (!profile.description.trim().length) {
      addDiagnostic(diagnostics, "error", "missing_description", `${profilePath}.description`, `Assistant workflow intent ${intent.id} tool selection profile ${normalized} description is required.`);
    }
    if (!profile.toolHints.length) {
      addDiagnostic(diagnostics, "error", "missing_tool_hints", `${profilePath}.toolHints`, `Assistant workflow intent ${intent.id} tool selection profile ${normalized} must define at least one tool hint.`);
    }
    for (const toolName of profile.toolHints) {
      if (toolNames.size > 0 && !toolNames.has(toolName)) {
        addDiagnostic(diagnostics, "error", "unknown_tool_capability", `${profilePath}.toolHints`, `Assistant workflow intent ${intent.id} tool selection profile ${normalized} references unknown tool capability: ${toolName}.`);
      }
    }
    validateToolSelectionProfileCondition(intent.id, profile, profilePath, subintentIds, diagnostics);
  }
}

function validatePlanningStepProfileCondition(
  intentId: string,
  profile: NonNullable<AssistantWorkflowDefinition<string, string, string, string>["intents"][number]["planningStepProfiles"]>[number],
  profilePath: string,
  diagnostics: AssistantWorkflowDefinitionDiagnostic[],
): void {
  const { minConfidence, maxConfidence, subintent, presentation, timeWindowHint, requiredTools } = profile.condition ?? {};
  if (minConfidence !== undefined && (!Number.isFinite(minConfidence) || minConfidence < 0 || minConfidence > 1)) {
    addDiagnostic(diagnostics, "error", "invalid_planning_step_profile_condition", `${profilePath}.condition.minConfidence`, `Assistant workflow intent ${intentId} planning step profile ${profile.id} minConfidence must be between 0 and 1.`);
  }
  if (maxConfidence !== undefined && (!Number.isFinite(maxConfidence) || maxConfidence < 0 || maxConfidence > 1)) {
    addDiagnostic(diagnostics, "error", "invalid_planning_step_profile_condition", `${profilePath}.condition.maxConfidence`, `Assistant workflow intent ${intentId} planning step profile ${profile.id} maxConfidence must be between 0 and 1.`);
  }
  if (minConfidence !== undefined && maxConfidence !== undefined && minConfidence > maxConfidence) {
    addDiagnostic(diagnostics, "error", "invalid_planning_step_profile_condition", `${profilePath}.condition`, `Assistant workflow intent ${intentId} planning step profile ${profile.id} minConfidence must not exceed maxConfidence.`);
  }
  if (subintent !== undefined && !subintent.trim().length) {
    addDiagnostic(diagnostics, "error", "invalid_planning_step_profile_condition", `${profilePath}.condition.subintent`, `Assistant workflow intent ${intentId} planning step profile ${profile.id} subintent must not be empty.`);
  }
  if (presentation !== undefined && !presentation.trim().length) {
    addDiagnostic(diagnostics, "error", "invalid_planning_step_profile_condition", `${profilePath}.condition.presentation`, `Assistant workflow intent ${intentId} planning step profile ${profile.id} presentation must not be empty.`);
  }
  if (timeWindowHint !== undefined && !timeWindowHint.trim().length) {
    addDiagnostic(diagnostics, "error", "invalid_planning_step_profile_condition", `${profilePath}.condition.timeWindowHint`, `Assistant workflow intent ${intentId} planning step profile ${profile.id} timeWindowHint must not be empty.`);
  }
  if (requiredTools !== undefined && requiredTools.length === 0) {
    addDiagnostic(diagnostics, "error", "invalid_planning_step_profile_condition", `${profilePath}.condition.requiredTools`, `Assistant workflow intent ${intentId} planning step profile ${profile.id} requiredTools must not be empty.`);
  }
}

function validateToolSelectionProfileCondition(
  intentId: string,
  profile: NonNullable<AssistantWorkflowDefinition<string, string, string, string>["intents"][number]["toolSelectionProfiles"]>[number],
  profilePath: string,
  subintentIds: ReadonlySet<string>,
  diagnostics: AssistantWorkflowDefinitionDiagnostic[],
): void {
  const { minHop, maxHop, selectedReason, subintent } = profile.condition ?? {};
  if (minHop !== undefined && (!Number.isInteger(minHop) || minHop < 0)) {
    addDiagnostic(diagnostics, "error", "invalid_tool_selection_profile_condition", `${profilePath}.condition.minHop`, `Assistant workflow intent ${intentId} tool selection profile ${profile.id} minHop must be a non-negative integer.`);
  }
  if (maxHop !== undefined && (!Number.isInteger(maxHop) || maxHop < 0)) {
    addDiagnostic(diagnostics, "error", "invalid_tool_selection_profile_condition", `${profilePath}.condition.maxHop`, `Assistant workflow intent ${intentId} tool selection profile ${profile.id} maxHop must be a non-negative integer.`);
  }
  if (minHop !== undefined && maxHop !== undefined && minHop > maxHop) {
    addDiagnostic(diagnostics, "error", "invalid_tool_selection_profile_condition", `${profilePath}.condition`, `Assistant workflow intent ${intentId} tool selection profile ${profile.id} minHop must not exceed maxHop.`);
  }
  if (subintent !== undefined && subintent !== null) {
    const normalizedSubintent = subintent.trim();
    if (!normalizedSubintent.length) {
      addDiagnostic(diagnostics, "error", "invalid_tool_selection_profile_condition", `${profilePath}.condition.subintent`, `Assistant workflow intent ${intentId} tool selection profile ${profile.id} subintent must not be empty.`);
    } else if (subintentIds.size > 0 && !subintentIds.has(normalizedSubintent)) {
      addDiagnostic(diagnostics, "error", "missing_id", `${profilePath}.condition.subintent`, `Assistant workflow intent ${intentId} tool selection profile ${profile.id} references unknown subintent: ${normalizedSubintent}.`);
    }
  }
  if (selectedReason !== undefined && !selectedReason.trim().length) {
    addDiagnostic(diagnostics, "error", "invalid_tool_selection_profile_condition", `${profilePath}.condition.selectedReason`, `Assistant workflow intent ${intentId} tool selection profile ${profile.id} selectedReason must not be empty.`);
  }
}

function addDiagnostic(
  diagnostics: AssistantWorkflowDefinitionDiagnostic[],
  severity: AssistantWorkflowDefinitionDiagnosticSeverity,
  code: AssistantWorkflowDefinitionDiagnosticCode,
  path: string,
  message: string,
): void {
  diagnostics.push({ severity, code, path, message });
}
