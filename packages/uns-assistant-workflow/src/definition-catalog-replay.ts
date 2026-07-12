import {
  buildAssistantWorkflowDefinitionCatalogTracePayload,
  buildAssistantWorkflowSerializedDefinitionCatalog,
  type AssistantWorkflowDefinitionCatalog,
} from "./definition-catalog.js";
import {
  parseAssistantWorkflowSerializedDefinitionLines,
  type AssistantWorkflowSerializedDefinitionLinesParseResult,
} from "./definition-json.js";
import {
  parseAssistantWorkflowDefinitionManifestLines,
  type AssistantWorkflowDefinitionManifestLinesParseResult,
} from "./definition-manifest.js";
import type { AssistantWorkflowJsonValue } from "./run-report-json.js";

export type AssistantWorkflowDefinitionCatalogReplayLinesInput = {
  definitionLines: string;
};

export type AssistantWorkflowDefinitionCatalogReplayLinesResult = {
  definitionParse: AssistantWorkflowSerializedDefinitionLinesParseResult;
  parseErrorCount: number;
  catalog: AssistantWorkflowDefinitionCatalog;
};

export type AssistantWorkflowDefinitionManifestCatalogReplayLinesInput = {
  manifestLines: string;
};

export type AssistantWorkflowDefinitionManifestCatalogReplayLinesResult = {
  manifestParse: AssistantWorkflowDefinitionManifestLinesParseResult;
  parseErrorCount: number;
  catalog: AssistantWorkflowDefinitionCatalog;
};

export function runAssistantWorkflowDefinitionCatalogReplayLines(
  input: AssistantWorkflowDefinitionCatalogReplayLinesInput,
): AssistantWorkflowDefinitionCatalogReplayLinesResult {
  const definitionParse = parseAssistantWorkflowSerializedDefinitionLines(input.definitionLines);
  const catalog = buildAssistantWorkflowSerializedDefinitionCatalog(definitionParse.definitions);
  return {
    definitionParse,
    parseErrorCount: definitionParse.errorCount,
    catalog,
  };
}

export function runAssistantWorkflowDefinitionManifestCatalogReplayLines(
  input: AssistantWorkflowDefinitionManifestCatalogReplayLinesInput,
): AssistantWorkflowDefinitionManifestCatalogReplayLinesResult {
  const manifestParse = parseAssistantWorkflowDefinitionManifestLines(input.manifestLines);
  const catalog = buildAssistantWorkflowSerializedDefinitionCatalog(
    manifestParse.manifests.map((manifest) => manifest.serializedDefinition),
  );
  return {
    manifestParse,
    parseErrorCount: manifestParse.errorCount,
    catalog,
  };
}

export function buildAssistantWorkflowDefinitionCatalogReplayLinesTracePayload(
  result: AssistantWorkflowDefinitionCatalogReplayLinesResult,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    definitionParse: {
      lineCount: result.definitionParse.lineCount,
      definitionCount: result.definitionParse.definitionCount,
      errorCount: result.definitionParse.errorCount,
      errors: result.definitionParse.errors.map((error) => ({
        lineNumber: error.lineNumber,
        reason: error.reason,
        preview: error.preview,
      })),
    },
    parseErrorCount: result.parseErrorCount,
    catalog: buildAssistantWorkflowDefinitionCatalogTracePayload(result.catalog),
  };
}

export function buildAssistantWorkflowDefinitionManifestCatalogReplayLinesTracePayload(
  result: AssistantWorkflowDefinitionManifestCatalogReplayLinesResult,
): Record<string, AssistantWorkflowJsonValue> {
  return {
    manifestParse: {
      lineCount: result.manifestParse.lineCount,
      manifestCount: result.manifestParse.manifestCount,
      errorCount: result.manifestParse.errorCount,
      errors: result.manifestParse.errors.map((error) => ({
        lineNumber: error.lineNumber,
        reason: error.reason,
        preview: error.preview,
      })),
    },
    parseErrorCount: result.parseErrorCount,
    catalog: buildAssistantWorkflowDefinitionCatalogTracePayload(result.catalog),
  };
}
