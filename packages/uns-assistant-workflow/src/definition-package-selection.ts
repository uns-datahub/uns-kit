import type { AssistantWorkflowSerializedDefinition } from "./definition-json.js";
import type { AssistantWorkflowDefinitionPackage } from "./definition-package.js";
import {
  findAssistantWorkflowDefinitionPackageDefinition,
  findLatestAssistantWorkflowDefinitionPackageDefinition,
} from "./definition-package-loader.js";
import type { AssistantWorkflowJsonValue } from "./run-report-json.js";

export type AssistantWorkflowDefinitionPackageSelectionStatus =
  | "selected"
  | "empty_package"
  | "ambiguous_workflow"
  | "not_found";

export type AssistantWorkflowDefinitionPackageSelectionRequest = {
  workflowId?: string;
  version?: number;
  includeInvalid?: boolean;
};

export type AssistantWorkflowDefinitionPackageSelectionResult =
  | {
    selected: true;
    status: "selected";
    workflowId: string;
    workflowVersion: number;
    definition: AssistantWorkflowSerializedDefinition;
    reason: string | null;
    candidateWorkflowIds: string[];
  }
  | {
    selected: false;
    status: "empty_package" | "ambiguous_workflow" | "not_found";
    workflowId: string | null;
    workflowVersion: number | null;
    definition: null;
    reason: string;
    candidateWorkflowIds: string[];
  };

export function selectAssistantWorkflowDefinitionFromPackage(
  definitionPackage: AssistantWorkflowDefinitionPackage,
  request: AssistantWorkflowDefinitionPackageSelectionRequest = {},
): AssistantWorkflowDefinitionPackageSelectionResult {
  const candidateWorkflowIds = listPackageWorkflowIds(definitionPackage);
  if (!candidateWorkflowIds.length) {
    return selectionFailure("empty_package", null, request.version ?? null, "Package does not contain any workflow definitions.", candidateWorkflowIds);
  }

  const workflowId = request.workflowId ?? inferSingleWorkflowId(candidateWorkflowIds);
  if (!workflowId) {
    return selectionFailure(
      "ambiguous_workflow",
      null,
      request.version ?? null,
      "Package contains multiple workflow ids; workflowId is required.",
      candidateWorkflowIds,
    );
  }

  const definition = request.version === undefined
    ? findLatestAssistantWorkflowDefinitionPackageDefinition(definitionPackage, workflowId, {
      ...(request.includeInvalid !== undefined ? { includeInvalid: request.includeInvalid } : {}),
    })
    : findAssistantWorkflowDefinitionPackageDefinition(definitionPackage, workflowId, request.version, {
      ...(request.includeInvalid !== undefined ? { includeInvalid: request.includeInvalid } : {}),
    });

  if (!definition) {
    return selectionFailure(
      "not_found",
      workflowId,
      request.version ?? null,
      request.version === undefined
        ? `No valid workflow definition found for ${workflowId}.`
        : `No valid workflow definition found for ${workflowId}@${request.version}.`,
      candidateWorkflowIds,
    );
  }

  return {
    selected: true,
    status: "selected",
    workflowId: definition.workflowId,
    workflowVersion: definition.workflowVersion,
    definition,
    reason: null,
    candidateWorkflowIds,
  };
}

export function buildAssistantWorkflowDefinitionPackageSelectionTracePayload(
  result: AssistantWorkflowDefinitionPackageSelectionResult,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    selected: result.selected,
    status: result.status,
    workflowId: result.workflowId,
    workflowVersion: result.workflowVersion,
    reason: result.reason,
    candidateWorkflowIds: result.candidateWorkflowIds,
    definition: result.definition
      ? {
        schemaVersion: result.definition.schemaVersion,
        workflowId: result.definition.workflowId,
        workflowVersion: result.definition.workflowVersion,
        summary: result.definition.summary,
      }
      : null,
  };
}

function listPackageWorkflowIds(definitionPackage: AssistantWorkflowDefinitionPackage): string[] {
  return [...new Set(definitionPackage.catalog.entries.map((entry) => entry.workflowId))].sort();
}

function inferSingleWorkflowId(candidateWorkflowIds: readonly string[]): string | null {
  return candidateWorkflowIds.length === 1 ? candidateWorkflowIds[0] ?? null : null;
}

function selectionFailure(
  status: "empty_package" | "ambiguous_workflow" | "not_found",
  workflowId: string | null,
  workflowVersion: number | null,
  reason: string,
  candidateWorkflowIds: string[],
): AssistantWorkflowDefinitionPackageSelectionResult {
  return {
    selected: false,
    status,
    workflowId,
    workflowVersion,
    definition: null,
    reason,
    candidateWorkflowIds,
  };
}
