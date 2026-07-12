import type { AssistantWorkflowDefinition } from "./definition.js";
import {
  buildAssistantWorkflowDefinitionTracePayload,
  parseAssistantWorkflowSerializedDefinition,
  serializeAssistantWorkflowDefinition,
  type AssistantWorkflowSerializedDefinition,
} from "./definition-json.js";
import type { AssistantWorkflowJsonValue } from "./run-report-json.js";

export const ASSISTANT_WORKFLOW_DEFINITION_MANIFEST_FORMAT = "assistant.workflow.definition";
export const ASSISTANT_WORKFLOW_DEFINITION_MANIFEST_VERSION = 1;

export type AssistantWorkflowDefinitionManifest = {
  format: typeof ASSISTANT_WORKFLOW_DEFINITION_MANIFEST_FORMAT;
  formatVersion: typeof ASSISTANT_WORKFLOW_DEFINITION_MANIFEST_VERSION;
  generatedAt: string;
  workflowId: string;
  workflowVersion: number;
  valid: boolean;
  serializedDefinition: AssistantWorkflowSerializedDefinition;
};

export type AssistantWorkflowDefinitionManifestOptions = {
  generatedAt?: string;
};

export type AssistantWorkflowDefinitionManifestLinesOptions =
  AssistantWorkflowDefinitionManifestOptions & {
    trailingNewline?: boolean;
  };

export type AssistantWorkflowDefinitionManifestLineErrorReason =
  | "invalid_json"
  | "invalid_manifest";

export type AssistantWorkflowDefinitionManifestLineError = {
  lineNumber: number;
  reason: AssistantWorkflowDefinitionManifestLineErrorReason;
  preview: string;
};

export type AssistantWorkflowDefinitionManifestLinesParseResult = {
  lineCount: number;
  manifestCount: number;
  errorCount: number;
  manifests: AssistantWorkflowDefinitionManifest[];
  errors: AssistantWorkflowDefinitionManifestLineError[];
};

export function buildAssistantWorkflowDefinitionManifest(
  definition: AssistantWorkflowDefinition<string, string, string, string>,
  options: AssistantWorkflowDefinitionManifestOptions = {},
): AssistantWorkflowDefinitionManifest {
  return buildAssistantWorkflowSerializedDefinitionManifest(
    serializeAssistantWorkflowDefinition(definition),
    options,
  );
}

export function buildAssistantWorkflowSerializedDefinitionManifest(
  serializedDefinition: AssistantWorkflowSerializedDefinition,
  options: AssistantWorkflowDefinitionManifestOptions = {},
): AssistantWorkflowDefinitionManifest {
  return {
    format: ASSISTANT_WORKFLOW_DEFINITION_MANIFEST_FORMAT,
    formatVersion: ASSISTANT_WORKFLOW_DEFINITION_MANIFEST_VERSION,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    workflowId: serializedDefinition.workflowId,
    workflowVersion: serializedDefinition.workflowVersion,
    valid: serializedDefinition.summary.valid,
    serializedDefinition,
  };
}

export function stringifyAssistantWorkflowDefinitionManifest(
  definition: AssistantWorkflowDefinition<string, string, string, string>,
  space?: number,
  options: AssistantWorkflowDefinitionManifestOptions = {},
): string {
  return JSON.stringify(buildAssistantWorkflowDefinitionManifest(definition, options), null, space);
}

export function stringifyAssistantWorkflowDefinitionManifestLines(
  definitions: readonly AssistantWorkflowDefinition<string, string, string, string>[],
  options: AssistantWorkflowDefinitionManifestLinesOptions = {},
): string {
  const lines = definitions.map((definition) =>
    JSON.stringify(buildAssistantWorkflowDefinitionManifest(definition, options)),
  );
  if (!lines.length) return "";
  return options.trailingNewline === true ? `${lines.join("\n")}\n` : lines.join("\n");
}

export function parseAssistantWorkflowDefinitionManifest(
  value: unknown,
): AssistantWorkflowDefinitionManifest | null {
  if (!isRecord(value)) return null;
  if (value["format"] !== ASSISTANT_WORKFLOW_DEFINITION_MANIFEST_FORMAT) return null;
  if (value["formatVersion"] !== ASSISTANT_WORKFLOW_DEFINITION_MANIFEST_VERSION) return null;
  if (typeof value["generatedAt"] !== "string" || !value["generatedAt"].trim().length) return null;
  if (typeof value["workflowId"] !== "string" || !value["workflowId"].trim().length) return null;
  if (typeof value["workflowVersion"] !== "number" || !Number.isFinite(value["workflowVersion"])) return null;
  if (typeof value["valid"] !== "boolean") return null;

  const serializedDefinition = parseAssistantWorkflowSerializedDefinition(value["serializedDefinition"]);
  if (!serializedDefinition) return null;
  if (serializedDefinition.workflowId !== value["workflowId"]) return null;
  if (serializedDefinition.workflowVersion !== value["workflowVersion"]) return null;
  if (serializedDefinition.summary.valid !== value["valid"]) return null;

  return {
    format: ASSISTANT_WORKFLOW_DEFINITION_MANIFEST_FORMAT,
    formatVersion: ASSISTANT_WORKFLOW_DEFINITION_MANIFEST_VERSION,
    generatedAt: value["generatedAt"],
    workflowId: value["workflowId"],
    workflowVersion: value["workflowVersion"],
    valid: value["valid"],
    serializedDefinition,
  };
}

export function parseAssistantWorkflowDefinitionManifestLines(
  input: string,
): AssistantWorkflowDefinitionManifestLinesParseResult {
  const manifests: AssistantWorkflowDefinitionManifest[] = [];
  const errors: AssistantWorkflowDefinitionManifestLineError[] = [];
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

    const manifest = parseAssistantWorkflowDefinitionManifest(parsed);
    if (!manifest) {
      errors.push({
        lineNumber,
        reason: "invalid_manifest",
        preview: previewLine(trimmed),
      });
      continue;
    }
    manifests.push(manifest);
  }

  return {
    lineCount,
    manifestCount: manifests.length,
    errorCount: errors.length,
    manifests,
    errors,
  };
}

export function buildAssistantWorkflowDefinitionManifestTracePayload(
  manifest: AssistantWorkflowDefinitionManifest,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    format: manifest.format,
    formatVersion: manifest.formatVersion,
    generatedAt: manifest.generatedAt,
    workflowId: manifest.workflowId,
    workflowVersion: manifest.workflowVersion,
    valid: manifest.valid,
    serializedDefinition: buildAssistantWorkflowDefinitionTracePayload(manifest.serializedDefinition),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function previewLine(value: string): string {
  return value.length <= 160 ? value : `${value.slice(0, 157)}...`;
}
