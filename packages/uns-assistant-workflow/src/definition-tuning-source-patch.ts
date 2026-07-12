import {
  buildAssistantWorkflowDefinitionTuningPromotion,
  buildAssistantWorkflowDefinitionTuningPromotionBrief,
  buildAssistantWorkflowDefinitionTuningPromotionBriefTracePayload,
  buildAssistantWorkflowDefinitionTuningPromotionTracePayload,
  type AssistantWorkflowDefinitionTuningPromotion,
} from "./definition-tuning-promotion.js";
import type { AssistantWorkflowDefinitionTuningReviewArtifact } from "./definition-tuning-review-artifact.js";
import {
  parseAssistantWorkflowSerializedDefinition,
  type AssistantWorkflowSerializedDefinition,
} from "./definition-json.js";
import type { AssistantWorkflowJsonValue } from "./run-report-json.js";

export const ASSISTANT_WORKFLOW_DEFINITION_TUNING_SOURCE_PATCH_SCHEMA_VERSION = 1;

export type AssistantWorkflowDefinitionTuningSourcePatchStatus =
  | "ready"
  | "blocked";

export type AssistantWorkflowDefinitionTuningSourcePatchOperation = {
  kind: "replace_workflow_definition";
  workflowId: string;
  fromVersion: number | null;
  toVersion: number | null;
  format: "assistant_workflow_serialized_definition_json";
  definition: AssistantWorkflowSerializedDefinition;
};

export type AssistantWorkflowDefinitionTuningSourcePatchArtifact = {
  schemaVersion: typeof ASSISTANT_WORKFLOW_DEFINITION_TUNING_SOURCE_PATCH_SCHEMA_VERSION;
  generatedAt: string;
  workflowId: string;
  fromVersion: number | null;
  toVersion: number | null;
  status: AssistantWorkflowDefinitionTuningSourcePatchStatus;
  target: {
    kind: "serialized_definition_file";
    suggestedFileName: string | null;
  };
  promotion: Record<string, AssistantWorkflowJsonValue>;
  brief: Record<string, AssistantWorkflowJsonValue>;
  operations: AssistantWorkflowDefinitionTuningSourcePatchOperation[];
  reasons: {
    code: "promotion_not_promotable";
    message: string;
    details: Record<string, AssistantWorkflowJsonValue>;
  }[];
};

export type AssistantWorkflowDefinitionTuningSourcePatchOptions = {
  generatedAt?: string;
  suggestedFileName?: string | null;
};

export function buildAssistantWorkflowDefinitionTuningSourcePatchArtifact(
  reviewArtifact: AssistantWorkflowDefinitionTuningReviewArtifact,
  promotion: AssistantWorkflowDefinitionTuningPromotion = buildAssistantWorkflowDefinitionTuningPromotion(reviewArtifact),
  options: AssistantWorkflowDefinitionTuningSourcePatchOptions = {},
): AssistantWorkflowDefinitionTuningSourcePatchArtifact {
  const brief = buildAssistantWorkflowDefinitionTuningPromotionBrief(reviewArtifact, promotion);
  const ready = promotion.status === "promotable";
  const fromVersion = promotion.summary.fromVersion;
  const toVersion = promotion.summary.toVersion;

  return {
    schemaVersion: ASSISTANT_WORKFLOW_DEFINITION_TUNING_SOURCE_PATCH_SCHEMA_VERSION,
    generatedAt: normalizeGeneratedAt(options.generatedAt) ?? new Date().toISOString(),
    workflowId: reviewArtifact.workflowId,
    fromVersion,
    toVersion,
    status: ready ? "ready" : "blocked",
    target: {
      kind: "serialized_definition_file",
      suggestedFileName: normalizeOptionalString(options.suggestedFileName) ?? `${reviewArtifact.workflowId}.workflow.json`,
    },
    promotion: buildAssistantWorkflowDefinitionTuningPromotionTracePayload(promotion),
    brief: buildAssistantWorkflowDefinitionTuningPromotionBriefTracePayload(brief),
    operations: ready
      ? [{
          kind: "replace_workflow_definition",
          workflowId: reviewArtifact.workflowId,
          fromVersion,
          toVersion,
          format: "assistant_workflow_serialized_definition_json",
          definition: reviewArtifact.patchedDefinition,
        }]
      : [],
    reasons: ready
      ? []
      : [{
          code: "promotion_not_promotable",
          message: "Source patch preview is blocked because the definition-tuning promotion is not promotable.",
          details: {
            promotionStatus: promotion.status,
            reasonCodes: promotion.reasons.map((reason) => reason.code),
          },
        }],
  };
}

export function buildAssistantWorkflowDefinitionTuningSourcePatchTracePayload(
  artifact: AssistantWorkflowDefinitionTuningSourcePatchArtifact,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    schemaVersion: artifact.schemaVersion,
    generatedAt: artifact.generatedAt,
    workflowId: artifact.workflowId,
    fromVersion: artifact.fromVersion,
    toVersion: artifact.toVersion,
    status: artifact.status,
    target: artifact.target,
    operationCount: artifact.operations.length,
    operations: artifact.operations.map((operation) => ({
      kind: operation.kind,
      workflowId: operation.workflowId,
      fromVersion: operation.fromVersion,
      toVersion: operation.toVersion,
      format: operation.format,
      definitionSummary: operation.definition.summary,
    })),
    promotion: artifact.promotion,
    brief: artifact.brief,
    reasons: artifact.reasons.map((reason) => ({
      code: reason.code,
      message: reason.message,
      details: reason.details,
    })),
  };
}

export function stringifyAssistantWorkflowDefinitionTuningSourcePatchArtifact(
  artifact: AssistantWorkflowDefinitionTuningSourcePatchArtifact,
  space?: number,
): string {
  return JSON.stringify(artifact, null, space);
}

export function parseAssistantWorkflowDefinitionTuningSourcePatchArtifact(
  value: unknown,
): AssistantWorkflowDefinitionTuningSourcePatchArtifact | null {
  if (!isRecord(value)) return null;
  if (value["schemaVersion"] !== ASSISTANT_WORKFLOW_DEFINITION_TUNING_SOURCE_PATCH_SCHEMA_VERSION) return null;
  if (typeof value["generatedAt"] !== "string" || !value["generatedAt"].trim().length) return null;
  if (typeof value["workflowId"] !== "string" || !value["workflowId"].trim().length) return null;
  if (!isNullableNumber(value["fromVersion"])) return null;
  if (!isNullableNumber(value["toVersion"])) return null;
  if (value["status"] !== "ready" && value["status"] !== "blocked") return null;
  const target = parsePatchTarget(value["target"]);
  if (!target) return null;
  if (!isJsonRecord(value["promotion"])) return null;
  if (!isJsonRecord(value["brief"])) return null;
  if (!Array.isArray(value["operations"])) return null;
  const operations = value["operations"].map(parsePatchOperation);
  if (operations.some((operation) => operation === null)) return null;
  const reasons = parsePatchReasons(value["reasons"]);
  if (!reasons) return null;

  return {
    schemaVersion: ASSISTANT_WORKFLOW_DEFINITION_TUNING_SOURCE_PATCH_SCHEMA_VERSION,
    generatedAt: value["generatedAt"],
    workflowId: value["workflowId"],
    fromVersion: value["fromVersion"],
    toVersion: value["toVersion"],
    status: value["status"],
    target,
    promotion: value["promotion"],
    brief: value["brief"],
    operations: operations.filter((operation): operation is AssistantWorkflowDefinitionTuningSourcePatchOperation =>
      operation !== null
    ),
    reasons,
  };
}

function parsePatchTarget(value: unknown): AssistantWorkflowDefinitionTuningSourcePatchArtifact["target"] | null {
  if (!isRecord(value)) return null;
  if (value["kind"] !== "serialized_definition_file") return null;
  if (!isNullableString(value["suggestedFileName"])) return null;
  return {
    kind: "serialized_definition_file",
    suggestedFileName: value["suggestedFileName"],
  };
}

function parsePatchOperation(value: unknown): AssistantWorkflowDefinitionTuningSourcePatchOperation | null {
  if (!isRecord(value)) return null;
  if (value["kind"] !== "replace_workflow_definition") return null;
  if (typeof value["workflowId"] !== "string" || !value["workflowId"].trim().length) return null;
  if (!isNullableNumber(value["fromVersion"])) return null;
  if (!isNullableNumber(value["toVersion"])) return null;
  if (value["format"] !== "assistant_workflow_serialized_definition_json") return null;
  const definition = parseAssistantWorkflowSerializedDefinition(value["definition"]);
  if (!definition) return null;
  return {
    kind: "replace_workflow_definition",
    workflowId: value["workflowId"],
    fromVersion: value["fromVersion"],
    toVersion: value["toVersion"],
    format: "assistant_workflow_serialized_definition_json",
    definition,
  };
}

function parsePatchReasons(
  value: unknown,
): AssistantWorkflowDefinitionTuningSourcePatchArtifact["reasons"] | null {
  if (!Array.isArray(value)) return null;
  const reasons = value.map((reason) => {
    if (!isRecord(reason)) return null;
    if (reason["code"] !== "promotion_not_promotable") return null;
    if (typeof reason["message"] !== "string") return null;
    if (!isJsonRecord(reason["details"])) return null;
    return {
      code: "promotion_not_promotable" as const,
      message: reason["message"],
      details: reason["details"],
    };
  });
  if (reasons.some((reason) => reason === null)) return null;
  return reasons.filter((reason): reason is AssistantWorkflowDefinitionTuningSourcePatchArtifact["reasons"][number] =>
    reason !== null
  );
}

function normalizeGeneratedAt(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isJsonRecord(value: unknown): value is Record<string, AssistantWorkflowJsonValue> {
  if (!isRecord(value)) return false;
  return Object.values(value).every(isJsonValue);
}

function isJsonValue(value: unknown): value is AssistantWorkflowJsonValue {
  if (value === null) return true;
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isJsonRecord(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}
