export type AssistantWorkflowExecutionBias = "allow-shortcuts" | "llm-first";

export type AssistantWorkflowFirstHopToolPolicy = "auto" | "require-tool";

export type AssistantWorkflowOptionalToolSelectionMode =
  | "classifier-confirmed"
  | "workflow-suggested";

export type AssistantWorkflowToolSelectionProfileCondition = {
  minHop?: number;
  maxHop?: number;
  selectedReason?: string;
  /** `null` explicitly matches classifications without a subintent. */
  subintent?: string | null;
  resolvedScope?: boolean;
  minAttributeCount?: number;
  maxAttributeCount?: number;
  requiredClassifierTools?: readonly string[];
};

export type AssistantWorkflowToolSelectionProfile = AssistantWorkflowVocabularyItem & {
  toolHints: readonly string[];
  toolExclusions?: readonly string[];
  condition?: AssistantWorkflowToolSelectionProfileCondition;
  optionalToolSelectionMode?: AssistantWorkflowOptionalToolSelectionMode;
};

export type AssistantWorkflowMemoryUse =
  | "thread-profile-read"
  | "thread-profile-write"
  | "thread-profile-inject";

export type AssistantWorkflowMemoryStorage =
  | "thread-profile"
  | "thread-state"
  | "turn";

export type AssistantWorkflowMemoryOperation = "read" | "write" | "inject";

export type AssistantWorkflowMemorySlotDefinition = {
  id: string;
  description: string;
  storage: AssistantWorkflowMemoryStorage;
  profileField?: string;
  maxChars?: number;
};

export type AssistantWorkflowMemoryPolicy = {
  read?: readonly string[];
  write?: readonly string[];
  inject?: readonly string[];
};

export type AssistantWorkflowPlanningStepKind =
  | "classify"
  | "resolve"
  | "retrieve"
  | "fetch"
  | "derive"
  | "build_artifact"
  | "ask_clarification"
  | "synthesize"
  | "generate";

export type AssistantWorkflowPlanningStepDefinition = AssistantWorkflowVocabularyItem & {
  kind: AssistantWorkflowPlanningStepKind;
  toolHints?: readonly string[];
  requiredToolHints?: readonly string[];
  readsMemory?: readonly string[];
  writesMemory?: readonly string[];
  optional?: boolean;
};

export type AssistantWorkflowPlanningStepProfileCondition = {
  subintent?: string;
  presentation?: string;
  timeWindowHint?: string;
  minConfidence?: number;
  maxConfidence?: number;
  requiredTools?: readonly string[];
};

export type AssistantWorkflowPlanningStepProfile = AssistantWorkflowVocabularyItem & {
  planningSteps: readonly string[];
  condition?: AssistantWorkflowPlanningStepProfileCondition;
};

export type AssistantWorkflowEntityKind =
  | "container"
  | "attribute"
  | "full_topic_path"
  | "time_window";

export type AssistantWorkflowClarificationCondition =
  | "low_confidence"
  | "missing_required_entity"
  | "multiple_entity_candidates"
  | "resolver_candidates_ambiguous"
  | "fallback_intent";

export type AssistantWorkflowClarificationQuestionStyle =
  | "confirm_intent"
  | "choose_entity"
  | "ask_scope"
  | "ask_next_step";

export type AssistantWorkflowClarificationRuleDefinition = AssistantWorkflowVocabularyItem & {
  condition: AssistantWorkflowClarificationCondition;
  questionStyle: AssistantWorkflowClarificationQuestionStyle;
  priority?: number;
  blocksExecution?: boolean;
  /** A host-provided resolved scope satisfies this rule without model-text inference. */
  satisfiedByResolvedScope?: boolean;
  confidenceBelow?: number;
  requiredEntityKinds?: readonly AssistantWorkflowEntityKind[];
  readsMemory?: readonly string[];
  writesMemory?: readonly string[];
};

export type AssistantWorkflowToolProvider =
  | "local-function"
  | "http"
  | "openai-hosted"
  | "mcp"
  | "repl";

export type AssistantWorkflowToolEffect = "read" | "compute" | "write";

export type AssistantWorkflowToolSideEffectRisk = "low" | "medium" | "high";

export type AssistantWorkflowToolCacheability =
  | "cacheable"
  | "request-scoped"
  | "not-cacheable";

export type AssistantWorkflowToolRetryClass = "safe" | "bounded" | "never";

export type AssistantWorkflowToolOutputKind =
  | "catalog"
  | "resolver"
  | "data"
  | "table"
  | "chart"
  | "link"
  | "artifact"
  | "evidence"
  | "schema"
  | "time"
  | "text";

export type AssistantWorkflowToolContextRequirement =
  | "auth"
  | "topic-scope"
  | "document-scope"
  | "confirmed-path"
  | "dashboard-id"
  | "schema-key";

export type AssistantWorkflowDirectRouteEffect = "read" | "compute" | "write";

export type AssistantWorkflowDirectRouteStrategyDefinition = AssistantWorkflowVocabularyItem & {
  requiredToolHints?: readonly string[];
};

export type AssistantWorkflowDirectRouteDefinition = AssistantWorkflowVocabularyItem & {
  effect: AssistantWorkflowDirectRouteEffect;
  outcomeRoute?: string;
  requiredToolHints?: readonly string[];
  strategies?: readonly AssistantWorkflowDirectRouteStrategyDefinition[];
  requiresConfirmation?: boolean;
};

export type AssistantWorkflowHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type AssistantWorkflowVocabularyItem<TId extends string = string> = {
  id: TId;
  description: string;
};

export type AssistantWorkflowToolCapabilityDefinition = {
  name: string;
  provider: AssistantWorkflowToolProvider;
  effect: AssistantWorkflowToolEffect;
  sideEffectRisk: AssistantWorkflowToolSideEffectRisk;
  cacheability: AssistantWorkflowToolCacheability;
  retryClass: AssistantWorkflowToolRetryClass;
  outputKinds: readonly AssistantWorkflowToolOutputKind[];
  requiredContext?: readonly AssistantWorkflowToolContextRequirement[];
  requiresConfirmation?: boolean;
};

export type AssistantWorkflowLocalFunctionToolBinding = {
  name: string;
  provider: "local-function";
  handlerId: string;
};

export type AssistantWorkflowHttpToolBinding = {
  name: string;
  provider: "http";
  method?: AssistantWorkflowHttpMethod;
  path: string;
  baseUrlRef?: string;
  operationId?: string;
};

export type AssistantWorkflowOpenAIHostedToolBinding = {
  name: string;
  provider: "openai-hosted";
  hostedToolType: string;
  toolName?: string;
};

export type AssistantWorkflowMcpToolBinding = {
  name: string;
  provider: "mcp";
  serverId: string;
  toolName: string;
};

export type AssistantWorkflowReplToolBinding = {
  name: string;
  provider: "repl";
  runtimeId: string;
  functionName?: string;
  commandTemplate?: string;
  allowFilesystem?: boolean;
  allowNetwork?: boolean;
};

export type AssistantWorkflowToolBindingDefinition =
  | AssistantWorkflowLocalFunctionToolBinding
  | AssistantWorkflowHttpToolBinding
  | AssistantWorkflowOpenAIHostedToolBinding
  | AssistantWorkflowMcpToolBinding
  | AssistantWorkflowReplToolBinding;

export type AssistantWorkflowIntentDefinition<
  TIntent extends string = string,
  TPresentation extends string = string,
> = AssistantWorkflowVocabularyItem<TIntent> & {
  defaultPresentation?: TPresentation | null;
  executionBias?: AssistantWorkflowExecutionBias | null;
  firstHopToolPolicy?: AssistantWorkflowFirstHopToolPolicy | null;
  optionalToolSelectionMode?: AssistantWorkflowOptionalToolSelectionMode;
  toolHints?: readonly string[];
  requiredToolHints?: readonly string[];
  toolSelectionProfiles?: readonly AssistantWorkflowToolSelectionProfile[];
  planningStepProfiles?: readonly AssistantWorkflowPlanningStepProfile[];
  memoryUse?: readonly AssistantWorkflowMemoryUse[];
  memoryPolicy?: AssistantWorkflowMemoryPolicy;
  directRoutes?: readonly string[];
  planningSteps?: readonly string[];
  clarificationRules?: readonly string[];
  plannerInstructions?: readonly string[];
};

export type AssistantWorkflowDefinition<
  TIntent extends string = string,
  TSubintent extends string = string,
  TPresentation extends string = string,
  TDerivedTransform extends string = string,
> = {
  id: string;
  version: number;
  description?: string;
  intents: readonly AssistantWorkflowIntentDefinition<TIntent, TPresentation>[];
  tools?: readonly AssistantWorkflowToolCapabilityDefinition[];
  toolBindings?: readonly AssistantWorkflowToolBindingDefinition[];
  directRoutes?: readonly AssistantWorkflowDirectRouteDefinition[];
  memorySlots?: readonly AssistantWorkflowMemorySlotDefinition[];
  planningSteps?: readonly AssistantWorkflowPlanningStepDefinition[];
  clarificationRules?: readonly AssistantWorkflowClarificationRuleDefinition[];
  subintents?: readonly AssistantWorkflowVocabularyItem<TSubintent>[];
  presentations?: readonly AssistantWorkflowVocabularyItem<TPresentation>[];
  derivedTransforms?: readonly AssistantWorkflowVocabularyItem<TDerivedTransform>[];
};

export type AssistantWorkflowPromptFacts = {
  intents: string;
  subintents: string;
  presentations: string;
  derivedTransforms: string;
};

export function defineAssistantWorkflow<
  TIntent extends string,
  TSubintent extends string = never,
  TPresentation extends string = never,
  TDerivedTransform extends string = never,
>(
  definition: AssistantWorkflowDefinition<TIntent, TSubintent, TPresentation, TDerivedTransform>,
): AssistantWorkflowDefinition<TIntent, TSubintent, TPresentation, TDerivedTransform> {
  assertWorkflowHeader(definition);
  assertUniqueVocabulary("intent", definition.intents);
  assertUniqueVocabulary("subintent", definition.subintents ?? []);
  assertUniqueVocabulary("presentation", definition.presentations ?? []);
  assertUniqueVocabulary("derived transform", definition.derivedTransforms ?? []);
  assertUniqueToolCapabilities(definition.tools ?? []);
  assertUniqueToolBindings(definition.toolBindings ?? []);
  assertUniqueDirectRoutes(definition.directRoutes ?? []);
  assertUniqueMemorySlots(definition.memorySlots ?? []);
  assertUniquePlanningSteps(definition.planningSteps ?? []);
  assertUniqueClarificationRules(definition.clarificationRules ?? []);
  assertIntentReferences(definition);
  return definition;
}

export function normalizeAssistantWorkflowId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length ? normalized : null;
}

export function getAssistantWorkflowIntentIds<TIntent extends string>(
  workflow: AssistantWorkflowDefinition<TIntent, string, string, string>,
): readonly TIntent[] {
  return workflow.intents.map((intent) => intent.id);
}

export function getAssistantWorkflowSubintentIds<TSubintent extends string>(
  workflow: AssistantWorkflowDefinition<string, TSubintent, string, string>,
): readonly TSubintent[] {
  return (workflow.subintents ?? []).map((subintent) => subintent.id);
}

export function getAssistantWorkflowPresentationIds<TPresentation extends string>(
  workflow: AssistantWorkflowDefinition<string, string, TPresentation, string>,
): readonly TPresentation[] {
  return (workflow.presentations ?? []).map((presentation) => presentation.id);
}

export function getAssistantWorkflowDerivedTransformIds<TDerivedTransform extends string>(
  workflow: AssistantWorkflowDefinition<string, string, string, TDerivedTransform>,
): readonly TDerivedTransform[] {
  return (workflow.derivedTransforms ?? []).map((transform) => transform.id);
}

export function findAssistantWorkflowIntent<TIntent extends string, TPresentation extends string>(
  workflow: AssistantWorkflowDefinition<TIntent, string, TPresentation, string>,
  intentId: unknown,
): AssistantWorkflowIntentDefinition<TIntent, TPresentation> | null {
  const normalized = normalizeAssistantWorkflowId(intentId);
  if (!normalized) return null;
  return workflow.intents.find((intent) => intent.id === normalized) ?? null;
}

export function getAssistantWorkflowToolHints(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
  intentId: unknown,
  availableToolNames?: readonly string[],
): string[] {
  const intent = findAssistantWorkflowIntent(workflow, intentId);
  if (!intent) return [];
  return filterWorkflowToolNames(intent.toolHints ?? [], availableToolNames);
}

export function getAssistantWorkflowRequiredToolHints(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
  intentId: unknown,
  availableToolNames?: readonly string[],
): string[] {
  const intent = findAssistantWorkflowIntent(workflow, intentId);
  if (!intent) return [];
  return filterWorkflowToolNames(intent.requiredToolHints ?? [], availableToolNames);
}

export function formatAssistantWorkflowVocabulary(
  items: readonly AssistantWorkflowVocabularyItem[],
  options: { includeDescriptions?: boolean } = {},
): string {
  const includeDescriptions = options.includeDescriptions ?? true;
  return items
    .map((item) => {
      const id = item.id.trim();
      const description = item.description.trim();
      return includeDescriptions && description.length ? `${id} = ${description}` : id;
    })
    .filter((entry) => entry.length > 0)
    .join("; ");
}

export function buildAssistantWorkflowPromptFacts(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
): AssistantWorkflowPromptFacts {
  return {
    intents: formatAssistantWorkflowVocabulary(workflow.intents),
    subintents: formatAssistantWorkflowVocabulary(workflow.subintents ?? []),
    presentations: formatAssistantWorkflowVocabulary(workflow.presentations ?? [], { includeDescriptions: false }),
    derivedTransforms: formatAssistantWorkflowVocabulary(workflow.derivedTransforms ?? [], { includeDescriptions: false }),
  };
}

function assertWorkflowHeader(workflow: AssistantWorkflowDefinition<string, string, string, string>): void {
  if (!workflow.id.trim().length) {
    throw new Error("Assistant workflow id is required.");
  }
  if (!Number.isInteger(workflow.version) || workflow.version < 1) {
    throw new Error("Assistant workflow version must be a positive integer.");
  }
  if (!workflow.intents.length) {
    throw new Error("Assistant workflow must define at least one intent.");
  }
}

function assertUniqueVocabulary(
  kind: string,
  items: readonly AssistantWorkflowVocabularyItem[],
): void {
  const seen = new Set<string>();
  for (const item of items) {
    const normalized = normalizeAssistantWorkflowId(item.id);
    if (!normalized) {
      throw new Error(`Assistant workflow ${kind} id is required.`);
    }
    if (normalized !== item.id) {
      throw new Error(`Assistant workflow ${kind} id must already be normalized: ${item.id}.`);
    }
    if (seen.has(normalized)) {
      throw new Error(`Duplicate assistant workflow ${kind} id: ${normalized}.`);
    }
    seen.add(normalized);
  }
}

function assertIntentReferences(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
): void {
  const toolCapabilities = new Map((workflow.tools ?? []).map((tool) => [tool.name, tool] as const));
  const presentationIds = new Set((workflow.presentations ?? []).map((presentation) => presentation.id));
  const toolNames = new Set(toolCapabilities.keys());
  const directRouteIds = new Set((workflow.directRoutes ?? []).map((route) => route.id));
  const memorySlotIds = new Set((workflow.memorySlots ?? []).map((slot) => slot.id));
  const planningStepIds = new Set((workflow.planningSteps ?? []).map((step) => step.id));
  const clarificationRuleIds = new Set((workflow.clarificationRules ?? []).map((rule) => rule.id));
  const subintentIds = new Set((workflow.subintents ?? []).map((subintent) => subintent.id));
  for (const binding of workflow.toolBindings ?? []) {
    const capability = toolCapabilities.get(binding.name);
    if (toolCapabilities.size > 0 && !capability) {
      throw new Error(`Assistant workflow tool binding references unknown tool capability: ${binding.name}.`);
    }
    if (capability && capability.provider !== binding.provider) {
      throw new Error(
        `Assistant workflow tool binding ${binding.name} provider ${binding.provider} does not match capability provider ${capability.provider}.`,
      );
    }
  }
  for (const step of workflow.planningSteps ?? []) {
    for (const toolName of [...(step.toolHints ?? []), ...(step.requiredToolHints ?? [])]) {
      if (toolNames.size > 0 && !toolNames.has(toolName)) {
        throw new Error(
          `Assistant workflow planning step ${step.id} references unknown tool capability: ${toolName}.`,
        );
      }
    }
    for (const slotId of [...(step.readsMemory ?? []), ...(step.writesMemory ?? [])]) {
      if (memorySlotIds.size > 0 && !memorySlotIds.has(slotId)) {
        throw new Error(
          `Assistant workflow planning step ${step.id} references unknown memory slot: ${slotId}.`,
        );
      }
    }
  }
  for (const rule of workflow.clarificationRules ?? []) {
    for (const slotId of [...(rule.readsMemory ?? []), ...(rule.writesMemory ?? [])]) {
      if (memorySlotIds.size > 0 && !memorySlotIds.has(slotId)) {
        throw new Error(
          `Assistant workflow clarification rule ${rule.id} references unknown memory slot: ${slotId}.`,
        );
      }
    }
  }
  for (const route of workflow.directRoutes ?? []) {
    for (const toolName of route.requiredToolHints ?? []) {
      if (toolNames.size > 0 && !toolNames.has(toolName)) {
        throw new Error(
          `Assistant workflow direct route ${route.id} references unknown tool capability: ${toolName}.`,
        );
      }
    }
  }
  for (const intent of workflow.intents) {
    assertUniqueToolSelectionProfiles(intent);
    assertUniquePlanningStepProfiles(intent);
    if (intent.defaultPresentation && !presentationIds.has(intent.defaultPresentation)) {
      throw new Error(
        `Assistant workflow intent ${intent.id} references unknown presentation: ${intent.defaultPresentation}.`,
      );
    }
    for (const toolName of [...(intent.toolHints ?? []), ...(intent.requiredToolHints ?? [])]) {
      if (toolNames.size > 0 && !toolNames.has(toolName)) {
        throw new Error(
          `Assistant workflow intent ${intent.id} references unknown tool capability: ${toolName}.`,
        );
      }
    }
    for (const [profileIndex, profile] of (intent.toolSelectionProfiles ?? []).entries()) {
      assertToolSelectionProfileCondition(intent.id, profile, toolNames, subintentIds);
      for (const toolName of profile.toolHints) {
        if (toolNames.size > 0 && !toolNames.has(toolName)) {
          throw new Error(
            `Assistant workflow intent ${intent.id} tool selection profile ${profile.id} references unknown tool capability: ${toolName}.`,
          );
        }
      }
      if (!profile.toolHints.length) {
        throw new Error(
          `Assistant workflow intent ${intent.id} tool selection profile ${profileIndex} must define at least one tool hint.`,
        );
      }
    }
    for (const [profileIndex, profile] of (intent.planningStepProfiles ?? []).entries()) {
      assertPlanningStepProfileCondition(intent.id, profile);
      if (!profile.planningSteps.length) {
        throw new Error(
          `Assistant workflow intent ${intent.id} planning step profile ${profileIndex} must define at least one planning step.`,
        );
      }
      for (const stepId of profile.planningSteps) {
        if (planningStepIds.size > 0 && !planningStepIds.has(stepId)) {
          throw new Error(
            `Assistant workflow intent ${intent.id} planning step profile ${profile.id} references unknown planning step: ${stepId}.`,
          );
        }
      }
      for (const toolName of profile.condition?.requiredTools ?? []) {
        if (toolNames.size > 0 && !toolNames.has(toolName)) {
          throw new Error(
            `Assistant workflow intent ${intent.id} planning step profile ${profile.id} references unknown required tool: ${toolName}.`,
          );
        }
      }
      const condition = profile.condition;
      if (condition?.subintent && subintentIds.size > 0 && !subintentIds.has(condition.subintent)) {
        throw new Error(
          `Assistant workflow intent ${intent.id} planning step profile ${profile.id} references unknown subintent: ${condition.subintent}.`,
        );
      }
      if (condition?.presentation && presentationIds.size > 0 && !presentationIds.has(condition.presentation)) {
        throw new Error(
          `Assistant workflow intent ${intent.id} planning step profile ${profile.id} references unknown presentation: ${condition.presentation}.`,
        );
      }
    }
    for (const slotId of [
      ...(intent.memoryPolicy?.read ?? []),
      ...(intent.memoryPolicy?.write ?? []),
      ...(intent.memoryPolicy?.inject ?? []),
    ]) {
      if (memorySlotIds.size > 0 && !memorySlotIds.has(slotId)) {
        throw new Error(
          `Assistant workflow intent ${intent.id} references unknown memory slot: ${slotId}.`,
        );
      }
    }
    for (const routeId of intent.directRoutes ?? []) {
      if (directRouteIds.size > 0 && !directRouteIds.has(routeId)) {
        throw new Error(
          `Assistant workflow intent ${intent.id} references unknown direct route: ${routeId}.`,
        );
      }
    }
    for (const stepId of intent.planningSteps ?? []) {
      if (planningStepIds.size > 0 && !planningStepIds.has(stepId)) {
        throw new Error(
          `Assistant workflow intent ${intent.id} references unknown planning step: ${stepId}.`,
        );
      }
    }
    for (const ruleId of intent.clarificationRules ?? []) {
      if (clarificationRuleIds.size > 0 && !clarificationRuleIds.has(ruleId)) {
        throw new Error(
          `Assistant workflow intent ${intent.id} references unknown clarification rule: ${ruleId}.`,
        );
      }
    }
  }
}

function assertUniqueDirectRoutes(routes: readonly AssistantWorkflowDirectRouteDefinition[]): void {
  assertUniqueVocabulary("direct route", routes);
  for (const route of routes) {
    if (route.outcomeRoute !== undefined && !normalizeAssistantWorkflowId(route.outcomeRoute)) {
      throw new Error(`Assistant workflow direct route ${route.id} outcomeRoute must be non-empty when provided.`);
    }
    if (route.outcomeRoute !== undefined && normalizeAssistantWorkflowId(route.outcomeRoute) !== route.outcomeRoute) {
      throw new Error(
        `Assistant workflow direct route ${route.id} outcomeRoute must already be normalized: ${route.outcomeRoute}.`,
      );
    }
    assertUniqueVocabulary(`direct route ${route.id} strategy`, route.strategies ?? []);
    for (const strategy of route.strategies ?? []) {
      if (strategy.id !== normalizeAssistantWorkflowId(strategy.id)) {
        throw new Error(
          `Assistant workflow direct route ${route.id} strategy id must already be normalized: ${strategy.id}.`,
        );
      }
    }
  }
}

function assertUniqueToolSelectionProfiles(intent: AssistantWorkflowIntentDefinition): void {
  const seen = new Set<string>();
  for (const profile of intent.toolSelectionProfiles ?? []) {
    const normalized = normalizeAssistantWorkflowId(profile.id);
    if (!normalized) {
      throw new Error(`Assistant workflow intent ${intent.id} tool selection profile id is required.`);
    }
    if (normalized !== profile.id) {
      throw new Error(
        `Assistant workflow intent ${intent.id} tool selection profile id must already be normalized: ${profile.id}.`,
      );
    }
    if (seen.has(normalized)) {
      throw new Error(`Duplicate assistant workflow intent ${intent.id} tool selection profile: ${normalized}.`);
    }
    seen.add(normalized);
    if (!profile.description.trim().length) {
      throw new Error(`Assistant workflow intent ${intent.id} tool selection profile ${normalized} description is required.`);
    }
  }
}

function assertUniquePlanningStepProfiles(intent: AssistantWorkflowIntentDefinition): void {
  const seen = new Set<string>();
  for (const profile of intent.planningStepProfiles ?? []) {
    const normalized = normalizeAssistantWorkflowId(profile.id);
    if (!normalized) {
      throw new Error(`Assistant workflow intent ${intent.id} planning step profile id is required.`);
    }
    if (normalized !== profile.id) {
      throw new Error(
        `Assistant workflow intent ${intent.id} planning step profile id must already be normalized: ${profile.id}.`,
      );
    }
    if (seen.has(normalized)) {
      throw new Error(`Duplicate assistant workflow intent ${intent.id} planning step profile: ${normalized}.`);
    }
    seen.add(normalized);
    if (!profile.description.trim().length) {
      throw new Error(`Assistant workflow intent ${intent.id} planning step profile ${normalized} description is required.`);
    }
  }
}

function assertToolSelectionProfileCondition(
  intentId: string,
  profile: AssistantWorkflowToolSelectionProfile,
  knownToolNames: ReadonlySet<string>,
  knownSubintentIds: ReadonlySet<string>,
): void {
  const {
    minHop,
    maxHop,
    selectedReason,
    subintent,
    minAttributeCount,
    maxAttributeCount,
    requiredClassifierTools,
  } = profile.condition ?? {};
  if (profile.toolExclusions !== undefined) {
    const normalizedExcludedTools = profile.toolExclusions
      .filter((toolName): toolName is string => typeof toolName === "string")
      .map((toolName) => toolName.trim())
      .filter((toolName) => toolName.length > 0);
    if (!normalizedExcludedTools.length) {
      throw new Error(
        `Assistant workflow intent ${intentId} tool selection profile ${profile.id} toolExclusions must contain at least one tool.`,
      );
    }
    const profileToolHints = new Set(profile.toolHints.map((toolName) => toolName.trim()));
    for (const toolName of normalizedExcludedTools) {
      if (!knownToolNames.has(toolName)) {
        throw new Error(
          `Assistant workflow intent ${intentId} tool selection profile ${profile.id} references unknown excluded tool capability: ${toolName}.`,
        );
      }
      if (profileToolHints.has(toolName)) {
        throw new Error(
          `Assistant workflow intent ${intentId} tool selection profile ${profile.id} must not both hint and exclude tool capability: ${toolName}.`,
        );
      }
    }
  }
  if (minHop !== undefined && (!Number.isInteger(minHop) || minHop < 0)) {
    throw new Error(
      `Assistant workflow intent ${intentId} tool selection profile ${profile.id} minHop must be a non-negative integer.`,
    );
  }
  if (maxHop !== undefined && (!Number.isInteger(maxHop) || maxHop < 0)) {
    throw new Error(
      `Assistant workflow intent ${intentId} tool selection profile ${profile.id} maxHop must be a non-negative integer.`,
    );
  }
  if (minHop !== undefined && maxHop !== undefined && minHop > maxHop) {
    throw new Error(
      `Assistant workflow intent ${intentId} tool selection profile ${profile.id} minHop must not exceed maxHop.`,
    );
  }
  if (subintent !== undefined && subintent !== null) {
    const normalizedSubintent = subintent.trim();
    if (!normalizedSubintent.length) {
      throw new Error(
        `Assistant workflow intent ${intentId} tool selection profile ${profile.id} subintent must not be empty.`,
      );
    }
    if (knownSubintentIds.size > 0 && !knownSubintentIds.has(normalizedSubintent)) {
      throw new Error(
        `Assistant workflow intent ${intentId} tool selection profile ${profile.id} references unknown subintent: ${normalizedSubintent}.`,
      );
    }
  }
  if (minAttributeCount !== undefined && (!Number.isInteger(minAttributeCount) || minAttributeCount < 0)) {
    throw new Error(
      `Assistant workflow intent ${intentId} tool selection profile ${profile.id} minAttributeCount must be a non-negative integer.`,
    );
  }
  if (maxAttributeCount !== undefined && (!Number.isInteger(maxAttributeCount) || maxAttributeCount < 0)) {
    throw new Error(
      `Assistant workflow intent ${intentId} tool selection profile ${profile.id} maxAttributeCount must be a non-negative integer.`,
    );
  }
  if (
    minAttributeCount !== undefined &&
    maxAttributeCount !== undefined &&
    minAttributeCount > maxAttributeCount
  ) {
    throw new Error(
      `Assistant workflow intent ${intentId} tool selection profile ${profile.id} minAttributeCount must not exceed maxAttributeCount.`,
    );
  }
  if (requiredClassifierTools !== undefined) {
    const normalizedRequiredTools = requiredClassifierTools
      .filter((toolName): toolName is string => typeof toolName === "string")
      .map((toolName) => toolName.trim())
      .filter((toolName) => toolName.length > 0);
    if (!normalizedRequiredTools.length) {
      throw new Error(
        `Assistant workflow intent ${intentId} tool selection profile ${profile.id} requiredClassifierTools must contain at least one tool.`,
      );
    }
    for (const toolName of normalizedRequiredTools) {
      if (!knownToolNames.has(toolName)) {
        throw new Error(
          `Assistant workflow intent ${intentId} tool selection profile ${profile.id} references unknown classifier tool capability: ${toolName}.`,
        );
      }
    }
  }
  if (selectedReason !== undefined && !selectedReason.trim().length) {
    throw new Error(
      `Assistant workflow intent ${intentId} tool selection profile ${profile.id} selectedReason must not be empty.`,
    );
  }
}

function assertPlanningStepProfileCondition(
  intentId: string,
  profile: AssistantWorkflowPlanningStepProfile,
): void {
  const { minConfidence, maxConfidence, subintent, presentation, timeWindowHint, requiredTools } = profile.condition ?? {};
  if (minConfidence !== undefined && (!Number.isFinite(minConfidence) || minConfidence < 0 || minConfidence > 1)) {
    throw new Error(
      `Assistant workflow intent ${intentId} planning step profile ${profile.id} minConfidence must be between 0 and 1.`,
    );
  }
  if (maxConfidence !== undefined && (!Number.isFinite(maxConfidence) || maxConfidence < 0 || maxConfidence > 1)) {
    throw new Error(
      `Assistant workflow intent ${intentId} planning step profile ${profile.id} maxConfidence must be between 0 and 1.`,
    );
  }
  if (minConfidence !== undefined && maxConfidence !== undefined && minConfidence > maxConfidence) {
    throw new Error(
      `Assistant workflow intent ${intentId} planning step profile ${profile.id} minConfidence must not exceed maxConfidence.`,
    );
  }
  if (subintent !== undefined && !subintent.trim().length) {
    throw new Error(
      `Assistant workflow intent ${intentId} planning step profile ${profile.id} subintent must not be empty.`,
    );
  }
  if (presentation !== undefined && !presentation.trim().length) {
    throw new Error(
      `Assistant workflow intent ${intentId} planning step profile ${profile.id} presentation must not be empty.`,
    );
  }
  if (timeWindowHint !== undefined && !timeWindowHint.trim().length) {
    throw new Error(
      `Assistant workflow intent ${intentId} planning step profile ${profile.id} timeWindowHint must not be empty.`,
    );
  }
  if (requiredTools !== undefined && requiredTools.length === 0) {
    throw new Error(
      `Assistant workflow intent ${intentId} planning step profile ${profile.id} requiredTools must not be empty.`,
    );
  }
}

function assertUniqueClarificationRules(
  rules: readonly AssistantWorkflowClarificationRuleDefinition[],
): void {
  const seen = new Set<string>();
  for (const rule of rules) {
    const normalized = normalizeAssistantWorkflowId(rule.id);
    if (!normalized) {
      throw new Error("Assistant workflow clarification rule id is required.");
    }
    if (normalized !== rule.id) {
      throw new Error(`Assistant workflow clarification rule id must already be normalized: ${rule.id}.`);
    }
    if (seen.has(normalized)) {
      throw new Error(`Duplicate assistant workflow clarification rule: ${normalized}.`);
    }
    seen.add(normalized);
    if (!rule.description.trim().length) {
      throw new Error(`Assistant workflow clarification rule ${normalized} description is required.`);
    }
    if (
      rule.condition === "low_confidence" &&
      rule.confidenceBelow !== undefined &&
      (!Number.isFinite(rule.confidenceBelow) || rule.confidenceBelow < 0 || rule.confidenceBelow > 1)
    ) {
      throw new Error(`Assistant workflow clarification rule ${normalized} confidenceBelow must be between 0 and 1.`);
    }
  }
}

function assertUniquePlanningSteps(
  steps: readonly AssistantWorkflowPlanningStepDefinition[],
): void {
  const seen = new Set<string>();
  for (const step of steps) {
    const normalized = normalizeAssistantWorkflowId(step.id);
    if (!normalized) {
      throw new Error("Assistant workflow planning step id is required.");
    }
    if (normalized !== step.id) {
      throw new Error(`Assistant workflow planning step id must already be normalized: ${step.id}.`);
    }
    if (seen.has(normalized)) {
      throw new Error(`Duplicate assistant workflow planning step: ${normalized}.`);
    }
    seen.add(normalized);
    if (!step.description.trim().length) {
      throw new Error(`Assistant workflow planning step ${normalized} description is required.`);
    }
  }
}

function assertUniqueMemorySlots(
  slots: readonly AssistantWorkflowMemorySlotDefinition[],
): void {
  const seen = new Set<string>();
  for (const slot of slots) {
    const normalized = normalizeAssistantWorkflowId(slot.id);
    if (!normalized) {
      throw new Error("Assistant workflow memory slot id is required.");
    }
    if (normalized !== slot.id) {
      throw new Error(`Assistant workflow memory slot id must already be normalized: ${slot.id}.`);
    }
    if (seen.has(normalized)) {
      throw new Error(`Duplicate assistant workflow memory slot: ${normalized}.`);
    }
    seen.add(normalized);
    if (!slot.description.trim().length) {
      throw new Error(`Assistant workflow memory slot ${normalized} description is required.`);
    }
  }
}

function assertUniqueToolCapabilities(
  tools: readonly AssistantWorkflowToolCapabilityDefinition[],
): void {
  const seen = new Set<string>();
  for (const tool of tools) {
    const normalized = normalizeAssistantWorkflowId(tool.name);
    if (!normalized) {
      throw new Error("Assistant workflow tool capability name is required.");
    }
    if (normalized !== tool.name) {
      throw new Error(`Assistant workflow tool capability name must already be normalized: ${tool.name}.`);
    }
    if (seen.has(normalized)) {
      throw new Error(`Duplicate assistant workflow tool capability: ${normalized}.`);
    }
    seen.add(normalized);
    if (!tool.outputKinds.length) {
      throw new Error(`Assistant workflow tool capability ${normalized} must define at least one output kind.`);
    }
  }
}

function assertUniqueToolBindings(
  bindings: readonly AssistantWorkflowToolBindingDefinition[],
): void {
  const seen = new Set<string>();
  for (const binding of bindings) {
    const normalized = normalizeAssistantWorkflowId(binding.name);
    if (!normalized) {
      throw new Error("Assistant workflow tool binding name is required.");
    }
    if (normalized !== binding.name) {
      throw new Error(`Assistant workflow tool binding name must already be normalized: ${binding.name}.`);
    }
    if (seen.has(normalized)) {
      throw new Error(`Duplicate assistant workflow tool binding: ${normalized}.`);
    }
    seen.add(normalized);
    assertToolBindingTarget(binding);
  }
}

function assertToolBindingTarget(binding: AssistantWorkflowToolBindingDefinition): void {
  switch (binding.provider) {
    case "local-function":
      assertNonEmptyBindingField(binding.name, "handlerId", binding.handlerId);
      return;
    case "http":
      assertNonEmptyBindingField(binding.name, "path", binding.path);
      if (binding.method !== undefined && binding.method !== binding.method.toUpperCase()) {
        throw new Error(`Assistant workflow tool binding ${binding.name} HTTP method must be uppercase.`);
      }
      return;
    case "openai-hosted":
      assertNonEmptyBindingField(binding.name, "hostedToolType", binding.hostedToolType);
      return;
    case "mcp":
      assertNonEmptyBindingField(binding.name, "serverId", binding.serverId);
      assertNonEmptyBindingField(binding.name, "toolName", binding.toolName);
      return;
    case "repl":
      assertNonEmptyBindingField(binding.name, "runtimeId", binding.runtimeId);
      if (!binding.functionName?.trim().length && !binding.commandTemplate?.trim().length) {
        throw new Error(
          `Assistant workflow tool binding ${binding.name} must define functionName or commandTemplate.`,
        );
      }
      return;
  }
}

function assertNonEmptyBindingField(toolName: string, fieldName: string, value: string): void {
  if (!value.trim().length) {
    throw new Error(`Assistant workflow tool binding ${toolName} ${fieldName} is required.`);
  }
}

function filterWorkflowToolNames(
  rawTools: readonly string[],
  availableToolNames?: readonly string[],
): string[] {
  const availableSet = availableToolNames ? new Set(availableToolNames) : null;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const rawTool of rawTools) {
    const tool = rawTool.trim();
    if (!tool.length || seen.has(tool)) continue;
    if (availableSet && !availableSet.has(tool)) continue;
    seen.add(tool);
    out.push(tool);
  }
  return out;
}
