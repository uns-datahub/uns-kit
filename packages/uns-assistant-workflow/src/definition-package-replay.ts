import {
  buildAssistantWorkflowDefinitionPackageTracePayload,
  buildAssistantWorkflowDefinitionManifestPackage,
  type AssistantWorkflowDefinitionPackage,
  type AssistantWorkflowDefinitionPackageOptions,
} from "./definition-package.js";
import {
  buildAssistantWorkflowDefinitionPackageReviewTracePayload,
  reviewAssistantWorkflowDefinitionPackage,
  type AssistantWorkflowDefinitionPackageReview,
} from "./definition-package-review.js";
import {
  parseAssistantWorkflowSerializedDefinitionLines,
  type AssistantWorkflowSerializedDefinitionLinesParseResult,
} from "./definition-json.js";
import {
  buildAssistantWorkflowSerializedDefinitionManifest,
  parseAssistantWorkflowDefinitionManifestLines,
  type AssistantWorkflowDefinitionManifest,
  type AssistantWorkflowDefinitionManifestLinesParseResult,
} from "./definition-manifest.js";
import type { AssistantWorkflowJsonValue } from "./run-report-json.js";

export type AssistantWorkflowDefinitionPackageInputFormat =
  | "serialized-definition"
  | "definition-manifest";

export type AssistantWorkflowDefinitionPackageReplayLinesInput = {
  definitionLines: string;
  format?: AssistantWorkflowDefinitionPackageInputFormat;
  packageOptions?: AssistantWorkflowDefinitionPackageOptions;
};

export type AssistantWorkflowDefinitionPackageReplayLinesParse =
  | {
    format: "serialized-definition";
    serializedDefinitionParse: AssistantWorkflowSerializedDefinitionLinesParseResult;
  }
  | {
    format: "definition-manifest";
    manifestParse: AssistantWorkflowDefinitionManifestLinesParseResult;
  };

export type AssistantWorkflowDefinitionPackageReplayLinesResult = {
  format: AssistantWorkflowDefinitionPackageInputFormat;
  parse: AssistantWorkflowDefinitionPackageReplayLinesParse;
  parseErrorCount: number;
  definitionPackage: AssistantWorkflowDefinitionPackage;
  review: AssistantWorkflowDefinitionPackageReview;
};

export function runAssistantWorkflowDefinitionPackageReplayLines(
  input: AssistantWorkflowDefinitionPackageReplayLinesInput,
): AssistantWorkflowDefinitionPackageReplayLinesResult {
  const format = input.format ?? "definition-manifest";
  const parsed = parsePackageInputLines(
    input.definitionLines,
    format,
    input.packageOptions?.generatedAt,
  );
  const definitionPackage = buildAssistantWorkflowDefinitionManifestPackage(
    parsed.manifests,
    input.packageOptions ?? {},
  );
  return {
    format,
    parse: parsed.parse,
    parseErrorCount: parsed.parseErrorCount,
    definitionPackage,
    review: reviewAssistantWorkflowDefinitionPackage(definitionPackage),
  };
}

export function buildAssistantWorkflowDefinitionPackageReplayLinesTracePayload(
  result: AssistantWorkflowDefinitionPackageReplayLinesResult,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    format: result.format,
    parse: buildParseTracePayload(result.parse),
    parseErrorCount: result.parseErrorCount,
    definitionPackage: buildAssistantWorkflowDefinitionPackageTracePayload(result.definitionPackage),
    review: buildAssistantWorkflowDefinitionPackageReviewTracePayload(result.review),
  };
}

function parsePackageInputLines(
  input: string,
  format: AssistantWorkflowDefinitionPackageInputFormat,
  generatedAt: string | undefined,
): {
  parse: AssistantWorkflowDefinitionPackageReplayLinesParse;
  parseErrorCount: number;
  manifests: AssistantWorkflowDefinitionManifest[];
} {
  if (format === "definition-manifest") {
    const manifestParse = parseAssistantWorkflowDefinitionManifestLines(input);
    return {
      parse: {
        format,
        manifestParse,
      },
      parseErrorCount: manifestParse.errorCount,
      manifests: manifestParse.manifests,
    };
  }

  const serializedDefinitionParse = parseAssistantWorkflowSerializedDefinitionLines(input);
  return {
    parse: {
      format,
      serializedDefinitionParse,
    },
    parseErrorCount: serializedDefinitionParse.errorCount,
    manifests: serializedDefinitionParse.definitions.map((definition) => buildAssistantWorkflowSerializedDefinitionManifest(
      definition,
      generatedAt ? { generatedAt } : {},
    )),
  };
}

function buildParseTracePayload(
  parse: AssistantWorkflowDefinitionPackageReplayLinesParse,
): Record<string, AssistantWorkflowJsonValue> {
  if (parse.format === "definition-manifest") {
    return {
      format: parse.format,
      lineCount: parse.manifestParse.lineCount,
      manifestCount: parse.manifestParse.manifestCount,
      errorCount: parse.manifestParse.errorCount,
      errors: parse.manifestParse.errors.map((error) => ({
        lineNumber: error.lineNumber,
        reason: error.reason,
        preview: error.preview,
      })),
    };
  }

  return {
    format: parse.format,
    lineCount: parse.serializedDefinitionParse.lineCount,
    definitionCount: parse.serializedDefinitionParse.definitionCount,
    errorCount: parse.serializedDefinitionParse.errorCount,
    errors: parse.serializedDefinitionParse.errors.map((error) => ({
      lineNumber: error.lineNumber,
      reason: error.reason,
      preview: error.preview,
    })),
  };
}
