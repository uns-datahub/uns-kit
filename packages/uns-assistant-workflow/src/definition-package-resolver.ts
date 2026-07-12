import {
  buildAssistantWorkflowDefinitionPackageLoadTracePayload,
  loadAssistantWorkflowDefinitionPackage,
  type AssistantWorkflowDefinitionPackageLoadOptions,
  type AssistantWorkflowDefinitionPackageLoadResult,
} from "./definition-package-loader.js";
import {
  buildAssistantWorkflowDefinitionPackageSelectionTracePayload,
  selectAssistantWorkflowDefinitionFromPackage,
  type AssistantWorkflowDefinitionPackageSelectionRequest,
  type AssistantWorkflowDefinitionPackageSelectionResult,
} from "./definition-package-selection.js";
import type { AssistantWorkflowSerializedDefinition } from "./definition-json.js";
import type { AssistantWorkflowJsonValue } from "./run-report-json.js";

export type AssistantWorkflowDefinitionPackageResolveStatus =
  | "resolved"
  | "load_failed"
  | "selection_failed";

export type AssistantWorkflowDefinitionPackageResolveOptions =
  AssistantWorkflowDefinitionPackageLoadOptions &
  AssistantWorkflowDefinitionPackageSelectionRequest;

export type AssistantWorkflowDefinitionPackageResolveResult =
  | {
    resolved: true;
    status: "resolved";
    definition: AssistantWorkflowSerializedDefinition;
    load: AssistantWorkflowDefinitionPackageLoadResult;
    selection: AssistantWorkflowDefinitionPackageSelectionResult;
    reason: string | null;
  }
  | {
    resolved: false;
    status: "load_failed";
    definition: null;
    load: AssistantWorkflowDefinitionPackageLoadResult;
    selection: null;
    reason: string;
  }
  | {
    resolved: false;
    status: "selection_failed";
    definition: null;
    load: AssistantWorkflowDefinitionPackageLoadResult;
    selection: AssistantWorkflowDefinitionPackageSelectionResult;
    reason: string;
  };

export function resolveAssistantWorkflowDefinitionFromPackage(
  value: unknown,
  options: AssistantWorkflowDefinitionPackageResolveOptions = {},
): AssistantWorkflowDefinitionPackageResolveResult {
  const load = loadAssistantWorkflowDefinitionPackage(value, {
    ...(options.allowBlocked !== undefined ? { allowBlocked: options.allowBlocked } : {}),
  });
  if (!load.loaded) {
    return {
      resolved: false,
      status: "load_failed",
      definition: null,
      load,
      selection: null,
      reason: load.blockingReasons.join(" ") || "Package could not be loaded.",
    };
  }

  const selection = selectAssistantWorkflowDefinitionFromPackage(load.definitionPackage, {
    ...(options.workflowId !== undefined ? { workflowId: options.workflowId } : {}),
    ...(options.version !== undefined ? { version: options.version } : {}),
    ...(options.includeInvalid !== undefined ? { includeInvalid: options.includeInvalid } : {}),
  });
  if (!selection.selected) {
    return {
      resolved: false,
      status: "selection_failed",
      definition: null,
      load,
      selection,
      reason: selection.reason,
    };
  }

  return {
    resolved: true,
    status: "resolved",
    definition: selection.definition,
    load,
    selection,
    reason: null,
  };
}

export function buildAssistantWorkflowDefinitionPackageResolveTracePayload(
  result: AssistantWorkflowDefinitionPackageResolveResult,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    resolved: result.resolved,
    status: result.status,
    reason: result.reason,
    definition: result.definition
      ? {
        schemaVersion: result.definition.schemaVersion,
        workflowId: result.definition.workflowId,
        workflowVersion: result.definition.workflowVersion,
        summary: result.definition.summary,
      }
      : null,
    load: buildAssistantWorkflowDefinitionPackageLoadTracePayload(result.load),
    selection: result.selection
      ? buildAssistantWorkflowDefinitionPackageSelectionTracePayload(result.selection)
      : null,
  };
}
