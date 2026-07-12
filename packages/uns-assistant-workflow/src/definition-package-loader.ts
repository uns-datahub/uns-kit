import {
  findAssistantWorkflowCatalogDefinition,
  findLatestAssistantWorkflowCatalogDefinition,
  type AssistantWorkflowDefinitionLookupOptions,
} from "./definition-catalog.js";
import type { AssistantWorkflowSerializedDefinition } from "./definition-json.js";
import {
  buildAssistantWorkflowDefinitionPackageTracePayload,
  parseAssistantWorkflowDefinitionPackage,
  type AssistantWorkflowDefinitionPackage,
} from "./definition-package.js";
import {
  buildAssistantWorkflowDefinitionPackageReviewTracePayload,
  reviewAssistantWorkflowDefinitionPackage,
  type AssistantWorkflowDefinitionPackageReview,
} from "./definition-package-review.js";
import type { AssistantWorkflowJsonValue } from "./run-report-json.js";

export type AssistantWorkflowDefinitionPackageLoadStatus =
  | "loaded"
  | "blocked"
  | "invalid_package";

export type AssistantWorkflowDefinitionPackageLoadOptions = {
  allowBlocked?: boolean;
};

export type AssistantWorkflowDefinitionPackageLoadResult =
  | {
    loaded: true;
    status: "loaded";
    definitionPackage: AssistantWorkflowDefinitionPackage;
    review: AssistantWorkflowDefinitionPackageReview;
    blockingReasons: string[];
    warningReasons: string[];
  }
  | {
    loaded: false;
    status: "blocked";
    definitionPackage: AssistantWorkflowDefinitionPackage;
    review: AssistantWorkflowDefinitionPackageReview;
    blockingReasons: string[];
    warningReasons: string[];
  }
  | {
    loaded: false;
    status: "invalid_package";
    definitionPackage: null;
    review: null;
    blockingReasons: string[];
    warningReasons: string[];
  };

export function loadAssistantWorkflowDefinitionPackage(
  value: unknown,
  options: AssistantWorkflowDefinitionPackageLoadOptions = {},
): AssistantWorkflowDefinitionPackageLoadResult {
  const definitionPackage = parseAssistantWorkflowDefinitionPackage(value);
  if (!definitionPackage) {
    return {
      loaded: false,
      status: "invalid_package",
      definitionPackage: null,
      review: null,
      blockingReasons: ["Package JSON is not a valid assistant workflow definition package."],
      warningReasons: [],
    };
  }

  const review = reviewAssistantWorkflowDefinitionPackage(definitionPackage);
  if (review.status === "blocked" && options.allowBlocked !== true) {
    return {
      loaded: false,
      status: "blocked",
      definitionPackage,
      review,
      blockingReasons: review.blockingReasons,
      warningReasons: review.warningReasons,
    };
  }

  return {
    loaded: true,
    status: "loaded",
    definitionPackage,
    review,
    blockingReasons: review.blockingReasons,
    warningReasons: review.warningReasons,
  };
}

export function findAssistantWorkflowDefinitionPackageDefinition(
  definitionPackage: AssistantWorkflowDefinitionPackage,
  workflowId: string,
  version?: number,
  options: AssistantWorkflowDefinitionLookupOptions = {},
): AssistantWorkflowSerializedDefinition | null {
  return findAssistantWorkflowCatalogDefinition(definitionPackage.catalog, workflowId, version, options);
}

export function findLatestAssistantWorkflowDefinitionPackageDefinition(
  definitionPackage: AssistantWorkflowDefinitionPackage,
  workflowId: string,
  options: AssistantWorkflowDefinitionLookupOptions = {},
): AssistantWorkflowSerializedDefinition | null {
  return findLatestAssistantWorkflowCatalogDefinition(definitionPackage.catalog, workflowId, options);
}

export function buildAssistantWorkflowDefinitionPackageLoadTracePayload(
  result: AssistantWorkflowDefinitionPackageLoadResult,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    loaded: result.loaded,
    status: result.status,
    blockingReasons: result.blockingReasons,
    warningReasons: result.warningReasons,
    definitionPackage: result.definitionPackage
      ? buildAssistantWorkflowDefinitionPackageTracePayload(result.definitionPackage)
      : null,
    review: result.review
      ? buildAssistantWorkflowDefinitionPackageReviewTracePayload(result.review)
      : null,
  };
}
