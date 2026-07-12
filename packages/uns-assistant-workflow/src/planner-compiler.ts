import {
  buildAssistantWorkflowPromptFacts,
  getAssistantWorkflowDerivedTransformIds,
  getAssistantWorkflowIntentIds,
  getAssistantWorkflowPresentationIds,
  getAssistantWorkflowSubintentIds,
  type AssistantWorkflowDefinition,
  type AssistantWorkflowPromptFacts,
} from "./definition.js";

export type AssistantWorkflowPlannerPromptFacts = AssistantWorkflowPromptFacts & {
  intentInstructions: string;
};

export type AssistantWorkflowPlannerCompilation<
  TIntent extends string = string,
  TSubintent extends string = string,
  TPresentation extends string = string,
  TDerivedTransform extends string = string,
> = {
  intentValues: readonly TIntent[];
  subintentValues: readonly TSubintent[];
  presentationValues: readonly TPresentation[];
  derivedTransformValues: readonly TDerivedTransform[];
  promptFacts: AssistantWorkflowPlannerPromptFacts;
};

export function compileAssistantWorkflowForPlanner<
  TIntent extends string,
  TSubintent extends string,
  TPresentation extends string,
  TDerivedTransform extends string,
>(
  workflow: AssistantWorkflowDefinition<TIntent, TSubintent, TPresentation, TDerivedTransform>,
): AssistantWorkflowPlannerCompilation<TIntent, TSubintent, TPresentation, TDerivedTransform> {
  return {
    intentValues: getAssistantWorkflowIntentIds(workflow),
    subintentValues: getAssistantWorkflowSubintentIds(workflow),
    presentationValues: getAssistantWorkflowPresentationIds(workflow),
    derivedTransformValues: getAssistantWorkflowDerivedTransformIds(workflow),
    promptFacts: {
      ...buildAssistantWorkflowPromptFacts(workflow),
      intentInstructions: formatAssistantWorkflowIntentInstructions(workflow),
    },
  };
}

export function formatAssistantWorkflowIntentInstructions(
  workflow: AssistantWorkflowDefinition<string, string, string, string>,
): string {
  return workflow.intents
    .map((intent) => {
      const parts = [
        `${intent.id} = ${intent.description.trim()}`,
        ...(intent.plannerInstructions ?? []).map((instruction) => instruction.trim()).filter(Boolean),
      ];
      return parts.join(" ");
    })
    .filter((entry) => entry.trim().length > 0)
    .join(" ");
}
