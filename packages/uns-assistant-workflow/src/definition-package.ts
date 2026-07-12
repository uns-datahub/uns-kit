import type { AssistantWorkflowDefinition } from "./definition.js";
import {
  buildAssistantWorkflowDefinitionCatalogTracePayload,
  buildAssistantWorkflowSerializedDefinitionCatalog,
  type AssistantWorkflowDefinitionCatalog,
} from "./definition-catalog.js";
import {
  buildAssistantWorkflowDefinitionManifest,
  buildAssistantWorkflowDefinitionManifestTracePayload,
  parseAssistantWorkflowDefinitionManifest,
  type AssistantWorkflowDefinitionManifest,
} from "./definition-manifest.js";
import type { AssistantWorkflowJsonValue } from "./run-report-json.js";

export const ASSISTANT_WORKFLOW_DEFINITION_PACKAGE_FORMAT = "assistant.workflow.definition-package";
export const ASSISTANT_WORKFLOW_DEFINITION_PACKAGE_VERSION = 1;

export type AssistantWorkflowDefinitionPackage = {
  format: typeof ASSISTANT_WORKFLOW_DEFINITION_PACKAGE_FORMAT;
  formatVersion: typeof ASSISTANT_WORKFLOW_DEFINITION_PACKAGE_VERSION;
  generatedAt: string;
  packageId: string;
  packageVersion?: string;
  description?: string;
  tags: string[];
  definitionCount: number;
  workflowCount: number;
  validDefinitionCount: number;
  invalidDefinitionCount: number;
  duplicateVersionCount: number;
  catalog: AssistantWorkflowDefinitionCatalog;
  manifests: AssistantWorkflowDefinitionManifest[];
};

export type AssistantWorkflowDefinitionPackageOptions = {
  generatedAt?: string;
  packageId?: string;
  packageVersion?: string;
  description?: string;
  tags?: readonly string[];
};

export function buildAssistantWorkflowDefinitionPackage(
  definitions: readonly AssistantWorkflowDefinition<string, string, string, string>[],
  options: AssistantWorkflowDefinitionPackageOptions = {},
): AssistantWorkflowDefinitionPackage {
  const manifests = definitions.map((definition) => buildAssistantWorkflowDefinitionManifest(definition, {
    ...(options.generatedAt ? { generatedAt: options.generatedAt } : {}),
  }));
  return buildAssistantWorkflowDefinitionManifestPackage(manifests, options);
}

export function buildAssistantWorkflowDefinitionManifestPackage(
  manifests: readonly AssistantWorkflowDefinitionManifest[],
  options: AssistantWorkflowDefinitionPackageOptions = {},
): AssistantWorkflowDefinitionPackage {
  const catalog = buildAssistantWorkflowSerializedDefinitionCatalog(
    manifests.map((manifest) => manifest.serializedDefinition),
    { ...(options.generatedAt ? { generatedAt: options.generatedAt } : {}) },
  );
  const packageId = options.packageId ?? derivePackageId(manifests);
  return {
    format: ASSISTANT_WORKFLOW_DEFINITION_PACKAGE_FORMAT,
    formatVersion: ASSISTANT_WORKFLOW_DEFINITION_PACKAGE_VERSION,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    packageId,
    ...(options.packageVersion ? { packageVersion: options.packageVersion } : {}),
    ...(options.description ? { description: options.description } : {}),
    tags: [...new Set(options.tags ?? [])].sort(),
    definitionCount: catalog.definitionCount,
    workflowCount: catalog.workflowCount,
    validDefinitionCount: catalog.validDefinitionCount,
    invalidDefinitionCount: catalog.invalidDefinitionCount,
    duplicateVersionCount: catalog.duplicateVersionCount,
    catalog,
    manifests: manifests.map((manifest) => ({ ...manifest })),
  };
}

export function stringifyAssistantWorkflowDefinitionPackage(
  definitions: readonly AssistantWorkflowDefinition<string, string, string, string>[],
  space?: number,
  options: AssistantWorkflowDefinitionPackageOptions = {},
): string {
  return JSON.stringify(buildAssistantWorkflowDefinitionPackage(definitions, options), null, space);
}

export function stringifyAssistantWorkflowDefinitionManifestPackage(
  manifests: readonly AssistantWorkflowDefinitionManifest[],
  space?: number,
  options: AssistantWorkflowDefinitionPackageOptions = {},
): string {
  return JSON.stringify(buildAssistantWorkflowDefinitionManifestPackage(manifests, options), null, space);
}

export function parseAssistantWorkflowDefinitionPackage(
  value: unknown,
): AssistantWorkflowDefinitionPackage | null {
  if (!isRecord(value)) return null;
  if (value["format"] !== ASSISTANT_WORKFLOW_DEFINITION_PACKAGE_FORMAT) return null;
  if (value["formatVersion"] !== ASSISTANT_WORKFLOW_DEFINITION_PACKAGE_VERSION) return null;
  if (typeof value["generatedAt"] !== "string" || !value["generatedAt"].trim().length) return null;
  if (typeof value["packageId"] !== "string" || !value["packageId"].trim().length) return null;
  if (value["packageVersion"] !== undefined && typeof value["packageVersion"] !== "string") return null;
  if (value["description"] !== undefined && typeof value["description"] !== "string") return null;
  if (!isStringArray(value["tags"])) return null;
  if (!Array.isArray(value["manifests"])) return null;

  const manifests = value["manifests"].map(parseAssistantWorkflowDefinitionManifest);
  if (manifests.some((manifest) => manifest === null)) return null;

  const options: AssistantWorkflowDefinitionPackageOptions = {
    generatedAt: value["generatedAt"],
    packageId: value["packageId"],
    tags: value["tags"],
    ...(value["packageVersion"] ? { packageVersion: value["packageVersion"] } : {}),
    ...(value["description"] ? { description: value["description"] } : {}),
  };
  const rebuilt = buildAssistantWorkflowDefinitionManifestPackage(
    manifests.filter((manifest): manifest is AssistantWorkflowDefinitionManifest => manifest !== null),
    options,
  );

  if (!matchesCount(value["definitionCount"], rebuilt.definitionCount)) return null;
  if (!matchesCount(value["workflowCount"], rebuilt.workflowCount)) return null;
  if (!matchesCount(value["validDefinitionCount"], rebuilt.validDefinitionCount)) return null;
  if (!matchesCount(value["invalidDefinitionCount"], rebuilt.invalidDefinitionCount)) return null;
  if (!matchesCount(value["duplicateVersionCount"], rebuilt.duplicateVersionCount)) return null;

  return rebuilt;
}

export function buildAssistantWorkflowDefinitionPackageTracePayload(
  definitionPackage: AssistantWorkflowDefinitionPackage,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    format: definitionPackage.format,
    formatVersion: definitionPackage.formatVersion,
    generatedAt: definitionPackage.generatedAt,
    packageId: definitionPackage.packageId,
    packageVersion: definitionPackage.packageVersion ?? null,
    description: definitionPackage.description ?? null,
    tags: definitionPackage.tags,
    definitionCount: definitionPackage.definitionCount,
    workflowCount: definitionPackage.workflowCount,
    validDefinitionCount: definitionPackage.validDefinitionCount,
    invalidDefinitionCount: definitionPackage.invalidDefinitionCount,
    duplicateVersionCount: definitionPackage.duplicateVersionCount,
    catalog: buildAssistantWorkflowDefinitionCatalogTracePayload(definitionPackage.catalog),
    manifests: definitionPackage.manifests.map(buildAssistantWorkflowDefinitionManifestTracePayload),
  };
}

function derivePackageId(manifests: readonly AssistantWorkflowDefinitionManifest[]): string {
  const workflowIds = [...new Set(manifests.map((manifest) => manifest.workflowId))].sort();
  if (workflowIds.length === 1 && workflowIds[0]) return workflowIds[0];
  if (workflowIds.length > 1) return `assistant-workflows-${workflowIds.length}`;
  return "assistant-workflows";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function matchesCount(value: unknown, expected: number): boolean {
  return typeof value === "number" && Number.isFinite(value) && value === expected;
}
