import type { AssistantWorkflowDefinitionDiagnostic } from "./definition-diagnostics.js";
import type { AssistantWorkflowDefinitionPackage } from "./definition-package.js";
import type { AssistantWorkflowJsonValue } from "./run-report-json.js";

export type AssistantWorkflowDefinitionPackageReviewStatus = "ready" | "warning" | "blocked";

export type AssistantWorkflowDefinitionPackageReviewDefinition = {
  workflowId: string;
  workflowVersion: number;
  valid: boolean;
  errorCount: number;
  warningCount: number;
  diagnostics: AssistantWorkflowDefinitionDiagnostic[];
};

export type AssistantWorkflowDefinitionPackageReview = {
  packageId: string;
  packageVersion?: string;
  status: AssistantWorkflowDefinitionPackageReviewStatus;
  definitionCount: number;
  workflowCount: number;
  validDefinitionCount: number;
  invalidDefinitionCount: number;
  warningDefinitionCount: number;
  duplicateVersionCount: number;
  blockingReasons: string[];
  warningReasons: string[];
  definitions: AssistantWorkflowDefinitionPackageReviewDefinition[];
};

export function reviewAssistantWorkflowDefinitionPackage(
  definitionPackage: AssistantWorkflowDefinitionPackage,
): AssistantWorkflowDefinitionPackageReview {
  const blockingReasons = collectBlockingReasons(definitionPackage);
  const warningReasons = collectWarningReasons(definitionPackage);
  return {
    packageId: definitionPackage.packageId,
    ...(definitionPackage.packageVersion ? { packageVersion: definitionPackage.packageVersion } : {}),
    status: blockingReasons.length > 0 ? "blocked" : warningReasons.length > 0 ? "warning" : "ready",
    definitionCount: definitionPackage.definitionCount,
    workflowCount: definitionPackage.workflowCount,
    validDefinitionCount: definitionPackage.validDefinitionCount,
    invalidDefinitionCount: definitionPackage.invalidDefinitionCount,
    warningDefinitionCount: definitionPackage.catalog.warningDefinitionCount,
    duplicateVersionCount: definitionPackage.duplicateVersionCount,
    blockingReasons,
    warningReasons,
    definitions: definitionPackage.catalog.entries.map((entry) => ({
      workflowId: entry.workflowId,
      workflowVersion: entry.workflowVersion,
      valid: entry.valid,
      errorCount: entry.errorCount,
      warningCount: entry.warningCount,
      diagnostics: entry.definition.diagnostics,
    })),
  };
}

export function buildAssistantWorkflowDefinitionPackageReviewTracePayload(
  review: AssistantWorkflowDefinitionPackageReview,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    packageId: review.packageId,
    packageVersion: review.packageVersion ?? null,
    status: review.status,
    definitionCount: review.definitionCount,
    workflowCount: review.workflowCount,
    validDefinitionCount: review.validDefinitionCount,
    invalidDefinitionCount: review.invalidDefinitionCount,
    warningDefinitionCount: review.warningDefinitionCount,
    duplicateVersionCount: review.duplicateVersionCount,
    blockingReasons: review.blockingReasons,
    warningReasons: review.warningReasons,
    definitions: review.definitions.map((definition) => ({
      workflowId: definition.workflowId,
      workflowVersion: definition.workflowVersion,
      valid: definition.valid,
      errorCount: definition.errorCount,
      warningCount: definition.warningCount,
      diagnostics: definition.diagnostics.map((diagnostic) => ({
        severity: diagnostic.severity,
        code: diagnostic.code,
        path: diagnostic.path,
        message: diagnostic.message,
      })),
    })),
  };
}

function collectBlockingReasons(definitionPackage: AssistantWorkflowDefinitionPackage): string[] {
  const reasons: string[] = [];
  if (definitionPackage.definitionCount === 0) {
    reasons.push("Package does not contain any workflow definitions.");
  }
  if (definitionPackage.invalidDefinitionCount > 0) {
    reasons.push(`${definitionPackage.invalidDefinitionCount} workflow definition(s) are invalid.`);
  }
  if (definitionPackage.duplicateVersionCount > 0) {
    reasons.push(`${definitionPackage.duplicateVersionCount} duplicate workflow id/version pair(s) exist.`);
  }
  return reasons;
}

function collectWarningReasons(definitionPackage: AssistantWorkflowDefinitionPackage): string[] {
  const reasons: string[] = [];
  if (definitionPackage.catalog.warningDefinitionCount > 0) {
    reasons.push(`${definitionPackage.catalog.warningDefinitionCount} workflow definition(s) have warnings.`);
  }
  return reasons;
}
