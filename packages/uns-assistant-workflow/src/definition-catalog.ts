import type { AssistantWorkflowDefinition } from "./definition.js";
import {
  buildAssistantWorkflowDefinitionTracePayload,
  serializeAssistantWorkflowDefinition,
  type AssistantWorkflowSerializedDefinition,
} from "./definition-json.js";
import type { AssistantWorkflowJsonValue } from "./run-report-json.js";

export type AssistantWorkflowDefinitionCatalogDiagnosticCode =
  | "duplicate_definition_version";

export type AssistantWorkflowDefinitionCatalogDiagnostic = {
  severity: "error" | "warning";
  code: AssistantWorkflowDefinitionCatalogDiagnosticCode;
  workflowId: string;
  workflowVersion: number;
  message: string;
};

export type AssistantWorkflowDefinitionCatalogEntry = {
  workflowId: string;
  workflowVersion: number;
  valid: boolean;
  errorCount: number;
  warningCount: number;
  intentCount: number;
  toolCapabilityCount: number;
  toolBindingCount: number;
  definition: AssistantWorkflowSerializedDefinition;
};

export type AssistantWorkflowDefinitionCatalog = {
  generatedAt: string;
  definitionCount: number;
  workflowCount: number;
  validDefinitionCount: number;
  invalidDefinitionCount: number;
  warningDefinitionCount: number;
  duplicateVersionCount: number;
  diagnostics: AssistantWorkflowDefinitionCatalogDiagnostic[];
  entries: AssistantWorkflowDefinitionCatalogEntry[];
};

export type AssistantWorkflowDefinitionCatalogOptions = {
  generatedAt?: string;
};

export type AssistantWorkflowDefinitionLookupOptions = {
  includeInvalid?: boolean;
};

export function buildAssistantWorkflowDefinitionCatalog(
  definitions: readonly AssistantWorkflowDefinition<string, string, string, string>[],
  options: AssistantWorkflowDefinitionCatalogOptions = {},
): AssistantWorkflowDefinitionCatalog {
  return buildAssistantWorkflowSerializedDefinitionCatalog(
    definitions.map(serializeAssistantWorkflowDefinition),
    options,
  );
}

export function buildAssistantWorkflowSerializedDefinitionCatalog(
  definitions: readonly AssistantWorkflowSerializedDefinition[],
  options: AssistantWorkflowDefinitionCatalogOptions = {},
): AssistantWorkflowDefinitionCatalog {
  const entries = definitions
    .map(toCatalogEntry)
    .sort((left, right) => {
      if (left.workflowId !== right.workflowId) return left.workflowId.localeCompare(right.workflowId);
      return right.workflowVersion - left.workflowVersion;
    });
  const diagnostics = collectCatalogDiagnostics(entries);
  const workflowIds = new Set(entries.map((entry) => entry.workflowId));

  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    definitionCount: entries.length,
    workflowCount: workflowIds.size,
    validDefinitionCount: entries.filter((entry) => entry.valid).length,
    invalidDefinitionCount: entries.filter((entry) => !entry.valid).length,
    warningDefinitionCount: entries.filter((entry) => entry.warningCount > 0).length,
    duplicateVersionCount: diagnostics.filter((diagnostic) => diagnostic.code === "duplicate_definition_version").length,
    diagnostics,
    entries,
  };
}

export function findAssistantWorkflowCatalogDefinition(
  catalog: AssistantWorkflowDefinitionCatalog,
  workflowId: string,
  version?: number,
  options: AssistantWorkflowDefinitionLookupOptions = {},
): AssistantWorkflowSerializedDefinition | null {
  const candidates = catalog.entries.filter((entry) =>
    entry.workflowId === workflowId &&
    (version === undefined || entry.workflowVersion === version) &&
    (options.includeInvalid === true || entry.valid)
  );
  return candidates[0]?.definition ?? null;
}

export function findLatestAssistantWorkflowCatalogDefinition(
  catalog: AssistantWorkflowDefinitionCatalog,
  workflowId: string,
  options: AssistantWorkflowDefinitionLookupOptions = {},
): AssistantWorkflowSerializedDefinition | null {
  return findAssistantWorkflowCatalogDefinition(catalog, workflowId, undefined, options);
}

export function buildAssistantWorkflowDefinitionCatalogTracePayload(
  catalog: AssistantWorkflowDefinitionCatalog,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    generatedAt: catalog.generatedAt,
    definitionCount: catalog.definitionCount,
    workflowCount: catalog.workflowCount,
    validDefinitionCount: catalog.validDefinitionCount,
    invalidDefinitionCount: catalog.invalidDefinitionCount,
    warningDefinitionCount: catalog.warningDefinitionCount,
    duplicateVersionCount: catalog.duplicateVersionCount,
    diagnostics: catalog.diagnostics.map((diagnostic) => ({
      severity: diagnostic.severity,
      code: diagnostic.code,
      workflowId: diagnostic.workflowId,
      workflowVersion: diagnostic.workflowVersion,
      message: diagnostic.message,
    })),
    entries: catalog.entries.map((entry) => ({
      workflowId: entry.workflowId,
      workflowVersion: entry.workflowVersion,
      valid: entry.valid,
      errorCount: entry.errorCount,
      warningCount: entry.warningCount,
      intentCount: entry.intentCount,
      toolCapabilityCount: entry.toolCapabilityCount,
      toolBindingCount: entry.toolBindingCount,
      definition: buildAssistantWorkflowDefinitionTracePayload(entry.definition),
    })),
  };
}

function toCatalogEntry(definition: AssistantWorkflowSerializedDefinition): AssistantWorkflowDefinitionCatalogEntry {
  return {
    workflowId: definition.workflowId,
    workflowVersion: definition.workflowVersion,
    valid: definition.summary.valid,
    errorCount: definition.summary.errorCount,
    warningCount: definition.summary.warningCount,
    intentCount: definition.summary.intentCount,
    toolCapabilityCount: definition.summary.toolCapabilityCount,
    toolBindingCount: definition.summary.toolBindingCount,
    definition,
  };
}

function collectCatalogDiagnostics(
  entries: readonly AssistantWorkflowDefinitionCatalogEntry[],
): AssistantWorkflowDefinitionCatalogDiagnostic[] {
  const counts = new Map<string, AssistantWorkflowDefinitionCatalogEntry[]>();
  for (const entry of entries) {
    const key = `${entry.workflowId}@${entry.workflowVersion}`;
    counts.set(key, [...(counts.get(key) ?? []), entry]);
  }
  return [...counts.values()]
    .filter((group) => group.length > 1)
    .map((group) => {
      const first = group[0];
      return {
        severity: "error",
        code: "duplicate_definition_version",
        workflowId: first?.workflowId ?? "",
        workflowVersion: first?.workflowVersion ?? 0,
        message: `Duplicate assistant workflow definition version: ${first?.workflowId}@${first?.workflowVersion}.`,
      };
    });
}
