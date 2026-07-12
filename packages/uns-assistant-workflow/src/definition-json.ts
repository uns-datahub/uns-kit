import type { AssistantWorkflowDefinition } from "./definition.js";
import {
  validateAssistantWorkflowDefinition,
  type AssistantWorkflowDefinitionDiagnostic,
} from "./definition-diagnostics.js";
import type { AssistantWorkflowJsonValue } from "./run-report-json.js";

export const ASSISTANT_WORKFLOW_DEFINITION_JSON_SCHEMA_VERSION = 1;

export type AssistantWorkflowDefinitionSummary = {
  workflowId: string;
  workflowVersion: number;
  valid: boolean;
  errorCount: number;
  warningCount: number;
  intentCount: number;
  toolCapabilityCount: number;
  toolBindingCount: number;
  memorySlotCount: number;
  planningStepCount: number;
  clarificationRuleCount: number;
  presentationCount: number;
  unboundToolNames: string[];
  bindingWithoutCapabilityNames: string[];
  providerMismatchToolNames: string[];
};

export type AssistantWorkflowSerializedDefinition = {
  schemaVersion: typeof ASSISTANT_WORKFLOW_DEFINITION_JSON_SCHEMA_VERSION;
  workflowId: string;
  workflowVersion: number;
  summary: AssistantWorkflowDefinitionSummary;
  diagnostics: AssistantWorkflowDefinitionDiagnostic[];
  definition: AssistantWorkflowDefinition<string, string, string, string>;
};

export type AssistantWorkflowSerializedDefinitionLinesOptions = {
  trailingNewline?: boolean;
};

export type AssistantWorkflowSerializedDefinitionLineErrorReason =
  | "invalid_json"
  | "invalid_definition";

export type AssistantWorkflowSerializedDefinitionLineError = {
  lineNumber: number;
  reason: AssistantWorkflowSerializedDefinitionLineErrorReason;
  preview: string;
};

export type AssistantWorkflowSerializedDefinitionLinesParseResult = {
  lineCount: number;
  definitionCount: number;
  errorCount: number;
  definitions: AssistantWorkflowSerializedDefinition[];
  errors: AssistantWorkflowSerializedDefinitionLineError[];
};

export function serializeAssistantWorkflowDefinition(
  definition: AssistantWorkflowDefinition<string, string, string, string>,
): AssistantWorkflowSerializedDefinition {
  const validation = validateAssistantWorkflowDefinition(definition);
  return {
    schemaVersion: ASSISTANT_WORKFLOW_DEFINITION_JSON_SCHEMA_VERSION,
    workflowId: definition.id,
    workflowVersion: definition.version,
    summary: buildAssistantWorkflowDefinitionSummary(definition, validation.diagnostics),
    diagnostics: validation.diagnostics,
    definition,
  };
}

export function stringifyAssistantWorkflowDefinition(
  definition: AssistantWorkflowDefinition<string, string, string, string>,
  space?: number,
): string {
  return JSON.stringify(serializeAssistantWorkflowDefinition(definition), null, space);
}

export function stringifyAssistantWorkflowDefinitionLines(
  definitions: readonly AssistantWorkflowDefinition<string, string, string, string>[],
  options: AssistantWorkflowSerializedDefinitionLinesOptions = {},
): string {
  const lines = definitions.map((definition) => JSON.stringify(serializeAssistantWorkflowDefinition(definition)));
  if (!lines.length) return "";
  return options.trailingNewline === true ? `${lines.join("\n")}\n` : lines.join("\n");
}

export function parseAssistantWorkflowSerializedDefinition(
  value: unknown,
): AssistantWorkflowSerializedDefinition | null {
  if (!isRecord(value)) return null;
  if (value["schemaVersion"] !== ASSISTANT_WORKFLOW_DEFINITION_JSON_SCHEMA_VERSION) return null;
  if (typeof value["workflowId"] !== "string" || !value["workflowId"].trim().length) return null;
  if (typeof value["workflowVersion"] !== "number" || !Number.isFinite(value["workflowVersion"])) return null;
  if (!isDefinitionSummary(value["summary"])) return null;
  if (!isDiagnosticArray(value["diagnostics"])) return null;
  if (!isSerializedDefinitionBody(value["definition"])) return null;

  return {
    schemaVersion: ASSISTANT_WORKFLOW_DEFINITION_JSON_SCHEMA_VERSION,
    workflowId: value["workflowId"],
    workflowVersion: value["workflowVersion"],
    summary: value["summary"],
    diagnostics: value["diagnostics"],
    definition: value["definition"],
  };
}

export function parseAssistantWorkflowSerializedDefinitionLines(
  input: string,
): AssistantWorkflowSerializedDefinitionLinesParseResult {
  const definitions: AssistantWorkflowSerializedDefinition[] = [];
  const errors: AssistantWorkflowSerializedDefinitionLineError[] = [];
  let lineCount = 0;

  for (const [index, line] of input.split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed.length) continue;
    const lineNumber = index + 1;
    lineCount += 1;

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      errors.push({
        lineNumber,
        reason: "invalid_json",
        preview: previewLine(trimmed),
      });
      continue;
    }

    const definition = parseAssistantWorkflowSerializedDefinition(parsed);
    if (!definition) {
      errors.push({
        lineNumber,
        reason: "invalid_definition",
        preview: previewLine(trimmed),
      });
      continue;
    }
    definitions.push(definition);
  }

  return {
    lineCount,
    definitionCount: definitions.length,
    errorCount: errors.length,
    definitions,
    errors,
  };
}

export function buildAssistantWorkflowDefinitionSummary(
  definition: AssistantWorkflowDefinition<string, string, string, string>,
  diagnostics: readonly AssistantWorkflowDefinitionDiagnostic[] = validateAssistantWorkflowDefinition(definition).diagnostics,
): AssistantWorkflowDefinitionSummary {
  return {
    workflowId: definition.id,
    workflowVersion: definition.version,
    valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    errorCount: diagnostics.filter((diagnostic) => diagnostic.severity === "error").length,
    warningCount: diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length,
    intentCount: definition.intents.length,
    toolCapabilityCount: definition.tools?.length ?? 0,
    toolBindingCount: definition.toolBindings?.length ?? 0,
    memorySlotCount: definition.memorySlots?.length ?? 0,
    planningStepCount: definition.planningSteps?.length ?? 0,
    clarificationRuleCount: definition.clarificationRules?.length ?? 0,
    presentationCount: definition.presentations?.length ?? 0,
    unboundToolNames: collectDiagnosticNames(diagnostics, "unbound_tool_capability"),
    bindingWithoutCapabilityNames: collectDiagnosticNames(diagnostics, "binding_without_capability"),
    providerMismatchToolNames: collectDiagnosticNames(diagnostics, "tool_provider_mismatch"),
  };
}

export function buildAssistantWorkflowDefinitionTracePayload(
  serialized: AssistantWorkflowSerializedDefinition,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    schemaVersion: serialized.schemaVersion,
    workflowId: serialized.workflowId,
    workflowVersion: serialized.workflowVersion,
    summary: serialized.summary,
    diagnostics: serialized.diagnostics.map((diagnostic) => ({
      severity: diagnostic.severity,
      code: diagnostic.code,
      path: diagnostic.path,
      message: diagnostic.message,
    })),
  };
}

function collectDiagnosticNames(
  diagnostics: readonly AssistantWorkflowDefinitionDiagnostic[],
  code: AssistantWorkflowDefinitionDiagnostic["code"],
): string[] {
  const names = diagnostics
    .filter((diagnostic) => diagnostic.code === code)
    .map((diagnostic) => {
      const toolMatch = /tool capability ([a-zA-Z0-9_-]+)/.exec(diagnostic.message);
      if (toolMatch?.[1]) return toolMatch[1];
      const bindingMatch = /tool capability: ([a-zA-Z0-9_-]+)/.exec(diagnostic.message);
      if (bindingMatch?.[1]) return bindingMatch[1];
      const providerMatch = /tool binding ([a-zA-Z0-9_-]+) provider/.exec(diagnostic.message);
      return providerMatch?.[1] ?? null;
    })
    .filter((name): name is string => name !== null);
  return [...new Set(names)].sort();
}

function isDefinitionSummary(value: unknown): value is AssistantWorkflowDefinitionSummary {
  if (!isRecord(value)) return false;
  return (
    typeof value["workflowId"] === "string" &&
    typeof value["workflowVersion"] === "number" &&
    typeof value["valid"] === "boolean" &&
    isNonNegativeNumber(value["errorCount"]) &&
    isNonNegativeNumber(value["warningCount"]) &&
    isNonNegativeNumber(value["intentCount"]) &&
    isNonNegativeNumber(value["toolCapabilityCount"]) &&
    isNonNegativeNumber(value["toolBindingCount"]) &&
    isNonNegativeNumber(value["memorySlotCount"]) &&
    isNonNegativeNumber(value["planningStepCount"]) &&
    isNonNegativeNumber(value["clarificationRuleCount"]) &&
    isNonNegativeNumber(value["presentationCount"]) &&
    isStringArray(value["unboundToolNames"]) &&
    isStringArray(value["bindingWithoutCapabilityNames"]) &&
    isStringArray(value["providerMismatchToolNames"])
  );
}

function isDiagnosticArray(value: unknown): value is AssistantWorkflowDefinitionDiagnostic[] {
  return Array.isArray(value) && value.every(isDiagnostic);
}

function isDiagnostic(value: unknown): value is AssistantWorkflowDefinitionDiagnostic {
  if (!isRecord(value)) return false;
  return (
    (value["severity"] === "error" || value["severity"] === "warning") &&
    typeof value["code"] === "string" &&
    typeof value["path"] === "string" &&
    typeof value["message"] === "string"
  );
}

function isSerializedDefinitionBody(
  value: unknown,
): value is AssistantWorkflowDefinition<string, string, string, string> {
  if (!isRecord(value)) return false;
  return (
    typeof value["id"] === "string" &&
    typeof value["version"] === "number" &&
    Array.isArray(value["intents"])
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function previewLine(line: string): string {
  return line.length <= 160 ? line : `${line.slice(0, 157)}...`;
}
