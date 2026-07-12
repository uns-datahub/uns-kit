import { describe, expect, it } from "vitest";
import {
  buildAssistantWorkflowToolSelectionDecision,
  buildAssistantWorkflowToolSelectionAuthorityAllowListProposal,
  buildAssistantWorkflowToolSelectionAuthorityAllowListProposalTracePayload,
  buildAssistantWorkflowToolSelectionEvaluationBatch,
  buildAssistantWorkflowToolSelectionEvaluationBatchTracePayload,
  buildAssistantWorkflowToolSelectionMigrationReport,
  buildAssistantWorkflowToolSelectionMigrationReportTracePayload,
  buildAssistantWorkflowToolSelectionMigrationReviewArtifact,
  buildAssistantWorkflowToolSelectionMigrationReviewArtifactTracePayload,
  buildAssistantWorkflowToolSelectionEvaluationTracePayload,
  defineAssistantWorkflow,
  evaluateAssistantWorkflowToolSelectionDecision,
  serializeAssistantWorkflowToolSelectionDecision,
  type AssistantWorkflowDefinition,
} from "../src/index.js";

describe("assistant workflow tool selection evaluation", () => {
  it("evaluates workflow-equivalent decisions without signals", () => {
    const decision = serializeAssistantWorkflowToolSelectionDecision(buildAssistantWorkflowToolSelectionDecision({
      workflow: defineAssistantWorkflow(workflow()),
      classification: {
        intent: "answer_docs",
        toolsToExpose: ["query_docs"],
        entities: {},
      },
      availableToolNames: ["query_docs", "list_docs"],
      selectedToolNames: ["query_docs"],
      selectedReason: "intent_pruned",
      availableContext: ["document-scope"],
    }));

    expect(evaluateAssistantWorkflowToolSelectionDecision(decision)).toMatchObject({
      authoritySource: "workflow",
      authorityReason: "workflow_equivalent",
      workflowStatus: "ready",
      selectedToolCount: 1,
      effectiveToolCount: 1,
      workflowSuggestedToolCount: 2,
      workflowSelectionCandidateToolCount: 1,
      signalCount: 0,
      warningCount: 0,
      signals: [],
    });
  });

  it("marks already workflow-owned decisions as confirmed authority segments", () => {
    const decision = serializeAssistantWorkflowToolSelectionDecision(buildAssistantWorkflowToolSelectionDecision({
      workflow: defineAssistantWorkflow(workflow()),
      classification: {
        intent: "answer_docs",
        toolsToExpose: ["query_docs"],
        entities: {},
      },
      availableToolNames: ["query_docs", "list_docs"],
      selectedToolNames: ["query_docs"],
      selectedReason: "workflow_equivalent",
      hop: 1,
      availableContext: ["document-scope"],
      workflowAuthorityIntentIds: ["answer_docs"],
    }));

    const batch = buildAssistantWorkflowToolSelectionEvaluationBatch([decision]);

    expect(batch).toMatchObject({
      intentReadiness: [{
        intentId: "answer_docs",
        decisionCount: 1,
        workflowAuthorityCount: 1,
        shadowEquivalentCount: 0,
        workflowDiffersCount: 0,
        workflowBlockedCount: 0,
        workflowUnavailableCount: 0,
        warningCount: 0,
        workflowAuthorityConfirmed: true,
        readyForWorkflowAuthority: false,
      }],
      segmentReadiness: [{
        segmentKey: "answer_docs|hop:1|workflow_equivalent",
        workflowAuthorityConfirmed: true,
        readyForWorkflowAuthority: false,
      }],
      readinessSummary: {
        readyIntentCount: 0,
        confirmedIntentCount: 1,
        readySegmentCount: 0,
        confirmedSegmentCount: 1,
        warningIntentCount: 0,
        warningSegmentCount: 0,
      },
    });
    expect(buildAssistantWorkflowToolSelectionEvaluationBatchTracePayload(batch)).toMatchObject({
      readinessSummary: {
        confirmedIntentCount: 1,
        confirmedSegmentCount: 1,
      },
      intentReadiness: [{
        workflowAuthorityConfirmed: true,
        readyForWorkflowAuthority: false,
      }],
      segmentReadiness: [{
        workflowAuthorityConfirmed: true,
        readyForWorkflowAuthority: false,
      }],
    });
  });

  it("evaluates workflow-vs-legacy differences as review signals", () => {
    const decision = serializeAssistantWorkflowToolSelectionDecision(buildAssistantWorkflowToolSelectionDecision({
      workflow: defineAssistantWorkflow(workflow()),
      classification: {
        intent: "answer_docs",
        toolsToExpose: ["query_docs"],
        entities: {},
      },
      availableToolNames: ["query_docs", "list_docs", "search_docs"],
      selectedToolNames: ["list_docs", "search_docs"],
      selectedReason: "intent_pruned",
      availableContext: ["document-scope"],
    }));

    expect(evaluateAssistantWorkflowToolSelectionDecision(decision)).toMatchObject({
      authoritySource: "legacy-pruner",
      authorityReason: "workflow_differs",
      signalCount: 6,
      warningCount: 1,
      signals: [{
        name: "legacy_authority",
        severity: "info",
        detail: "workflow_differs",
      }, {
        name: "workflow_differs",
        severity: "info",
        detail: "missing=query_docs; outside=list_docs,search_docs",
      }, {
        name: "workflow_candidate_not_selected",
        severity: "warning",
        detail: "query_docs",
      }, {
        name: "selected_outside_workflow_candidate",
        severity: "info",
        detail: "list_docs, search_docs",
      }, {
        name: "selected_outside_workflow_suggestions",
        severity: "info",
        detail: "search_docs",
      }, {
        name: "selected_policy_excluded_optional_tool",
        severity: "info",
        detail: "list_docs",
      }],
    });
  });

  it("marks shadow-equivalent decisions as intent readiness candidates", () => {
    const decision = serializeAssistantWorkflowToolSelectionDecision(buildAssistantWorkflowToolSelectionDecision({
      workflow: defineAssistantWorkflow(workflow()),
      classification: {
        intent: "answer_docs",
        toolsToExpose: ["query_docs"],
        entities: {},
      },
      availableToolNames: ["query_docs", "list_docs"],
      selectedToolNames: ["query_docs"],
      selectedReason: "intent_pruned",
      availableContext: ["document-scope"],
      workflowAuthorityIntentIds: ["value_lookup"],
    }));

    expect(evaluateAssistantWorkflowToolSelectionDecision(decision)).toMatchObject({
      intentId: "answer_docs",
      authoritySource: "legacy-pruner",
      authorityReason: "workflow_authority_not_enabled",
      hop: null,
      selectedReason: "intent_pruned",
      workflowAuthorityEnabled: false,
      signalCount: 2,
      warningCount: 0,
      signals: [{
        name: "legacy_authority",
        severity: "info",
        detail: "workflow_authority_not_enabled",
      }, {
        name: "workflow_authority_not_enabled",
        severity: "info",
        detail: "answer_docs",
      }],
    });

    expect(buildAssistantWorkflowToolSelectionEvaluationBatch([decision])).toMatchObject({
      intentCounts: [{
        key: "answer_docs",
        count: 1,
      }],
      intentReadiness: [{
        intentId: "answer_docs",
        decisionCount: 1,
        workflowAuthorityCount: 0,
        shadowEquivalentCount: 1,
        workflowDiffersCount: 0,
        workflowBlockedCount: 0,
        workflowUnavailableCount: 0,
        warningCount: 0,
        readyForWorkflowAuthority: true,
      }],
      segmentReadiness: [{
        segmentKey: "answer_docs|hop:unknown|intent_pruned",
        intentId: "answer_docs",
        hop: null,
        selectedReason: "intent_pruned",
        decisionCount: 1,
        shadowEquivalentCount: 1,
        readyForWorkflowAuthority: true,
      }],
      readinessSummary: {
        readyIntentCount: 1,
        confirmedIntentCount: 0,
        readySegmentCount: 1,
        confirmedSegmentCount: 0,
        warningIntentCount: 0,
        warningSegmentCount: 0,
      },
    });
  });

  it("builds actionable migration candidates from readiness batches", () => {
    const workflowDefinition = defineAssistantWorkflow(workflow());
    const readyDecision = serializeAssistantWorkflowToolSelectionDecision(buildAssistantWorkflowToolSelectionDecision({
      workflow: workflowDefinition,
      classification: {
        intent: "answer_docs",
        toolsToExpose: ["query_docs"],
        entities: {},
      },
      availableToolNames: ["query_docs", "list_docs"],
      selectedToolNames: ["query_docs"],
      selectedReason: "intent_pruned",
      hop: 0,
      availableContext: ["document-scope"],
      workflowAuthorityIntentIds: ["value_lookup"],
    }));
    const confirmedDecision = serializeAssistantWorkflowToolSelectionDecision(buildAssistantWorkflowToolSelectionDecision({
      workflow: workflowDefinition,
      classification: {
        intent: "answer_docs",
        toolsToExpose: ["query_docs"],
        entities: {},
      },
      availableToolNames: ["query_docs", "list_docs"],
      selectedToolNames: ["query_docs"],
      selectedReason: "workflow_equivalent",
      hop: 0,
      availableContext: ["document-scope"],
      workflowAuthorityIntentIds: ["answer_docs"],
    }));
    const batch = buildAssistantWorkflowToolSelectionEvaluationBatch([readyDecision, confirmedDecision]);

    const report = buildAssistantWorkflowToolSelectionMigrationReport(batch);

    expect(report).toMatchObject({
      sourceDecisionCount: 2,
      rowCount: 2,
      suggestedAuthorityIntentIds: [],
      readyIntentCandidates: [],
      confirmedIntentCandidates: [],
      readySegmentCandidates: [{
        kind: "segment",
        intentId: "answer_docs",
        segmentKey: "answer_docs|hop:0|intent_pruned",
        status: "ready_for_workflow_authority",
        recommendedAction: "review_segment_before_authority_change",
        blockingReasons: [],
      }],
      confirmedSegmentCandidates: [{
        kind: "segment",
        intentId: "answer_docs",
        segmentKey: "answer_docs|hop:0|workflow_equivalent",
        status: "workflow_authority_confirmed",
        recommendedAction: "keep_runtime_authority",
        blockingReasons: [],
      }],
      reviewCandidates: expect.arrayContaining([
        expect.objectContaining({
          kind: "intent",
          intentId: "answer_docs",
          status: "needs_review",
          blockingReasons: ["mixed_authority_evidence"],
        }),
      ]),
    });
    expect(buildAssistantWorkflowToolSelectionMigrationReportTracePayload(report)).toMatchObject({
      readySegmentCandidates: [{
        recommendedAction: "review_segment_before_authority_change",
      }],
      confirmedSegmentCandidates: [{
        recommendedAction: "keep_runtime_authority",
      }],
    });
  });

  it("suggests intent allow-list additions only when the whole intent is shadow-equivalent", () => {
    const decision = serializeAssistantWorkflowToolSelectionDecision(buildAssistantWorkflowToolSelectionDecision({
      workflow: defineAssistantWorkflow(workflow()),
      classification: {
        intent: "answer_docs",
        toolsToExpose: ["query_docs"],
        entities: {},
      },
      availableToolNames: ["query_docs", "list_docs"],
      selectedToolNames: ["query_docs"],
      selectedReason: "intent_pruned",
      availableContext: ["document-scope"],
      workflowAuthorityIntentIds: ["value_lookup"],
    }));
    const report = buildAssistantWorkflowToolSelectionMigrationReport(
      buildAssistantWorkflowToolSelectionEvaluationBatch([decision]),
    );

    expect(report).toMatchObject({
      suggestedAuthorityIntentIds: ["answer_docs"],
      readyIntentCandidates: [{
        kind: "intent",
        intentId: "answer_docs",
        segmentKey: null,
        status: "ready_for_workflow_authority",
        recommendedAction: "add_intent_to_authority_allow_list",
        blockingReasons: [],
      }],
    });

    const proposal = buildAssistantWorkflowToolSelectionAuthorityAllowListProposal(report, {
      currentAuthorityIntentIds: ["value_lookup"],
      currentAuthoritySegmentKeys: ["value_lookup|hop:1|intent_pruned"],
    });
    expect(proposal).toMatchObject({
      currentAuthorityIntentIds: ["value_lookup"],
      currentAuthoritySegmentKeys: ["value_lookup|hop:1|intent_pruned"],
      suggestedAuthorityIntentIds: ["answer_docs"],
      suggestedAuthoritySegmentKeys: ["answer_docs|hop:unknown|intent_pruned"],
      addIntentIds: ["answer_docs"],
      addSegmentKeys: ["answer_docs|hop:unknown|intent_pruned"],
      keepIntentIds: ["value_lookup"],
      keepSegmentKeys: ["value_lookup|hop:1|intent_pruned"],
      proposedAuthorityIntentIds: ["value_lookup", "answer_docs"],
      proposedAuthoritySegmentKeys: ["value_lookup|hop:1|intent_pruned", "answer_docs|hop:unknown|intent_pruned"],
      readyIntentCandidateCount: 1,
      readySegmentCandidateCount: 1,
      confirmedIntentCandidateCount: 0,
      confirmedSegmentCandidateCount: 0,
      reviewIntentCandidateCount: 0,
      reviewSegmentCandidateCount: 0,
      reviewIntentIds: [],
      reviewSegmentKeys: [],
      currentIntentIdsWithReviewEvidence: [],
      currentSegmentKeysWithReviewEvidence: [],
      canApplyAdditions: true,
      rationale: expect.arrayContaining([
        "Add answer_docs to workflow authority after 1 matching decision(s) with no blockers.",
        "Add segment authority for answer_docs|hop:unknown|intent_pruned after 1 matching decision(s) with no blockers.",
        "Keep existing workflow authority intents: value_lookup.",
        "Keep existing workflow authority segments: value_lookup|hop:1|intent_pruned.",
      ]),
    });
    expect(buildAssistantWorkflowToolSelectionAuthorityAllowListProposalTracePayload(proposal)).toMatchObject({
      addIntentIds: ["answer_docs"],
      addSegmentKeys: ["answer_docs|hop:unknown|intent_pruned"],
      proposedAuthorityIntentIds: ["value_lookup", "answer_docs"],
      proposedAuthoritySegmentKeys: ["value_lookup|hop:1|intent_pruned", "answer_docs|hop:unknown|intent_pruned"],
      canApplyAdditions: true,
    });
    const artifact = buildAssistantWorkflowToolSelectionMigrationReviewArtifact({
      report,
      proposal,
    }, {
      title: "Docs assistant migration",
      patchTargets: ["src/default-workflow.ts"],
      requiredTestIds: ["pnpm test"],
    });
    expect(artifact).toMatchObject({
      title: "Docs assistant migration",
      status: "ready_for_runtime_change",
      recommendedAction: "apply_authority_allow_list_update",
      patchTargets: ["src/default-workflow.ts"],
      requiredTestIds: ["pnpm test"],
      runtimeChange: {
        addIntentIds: ["answer_docs"],
        addSegmentKeys: ["answer_docs|hop:unknown|intent_pruned"],
        proposedAuthorityIntentIds: ["value_lookup", "answer_docs"],
        proposedAuthoritySegmentKeys: ["value_lookup|hop:1|intent_pruned", "answer_docs|hop:unknown|intent_pruned"],
      },
      evidence: {
        readyIntentCandidateKeys: ["answer_docs"],
        readySegmentCandidateKeys: ["answer_docs|hop:unknown|intent_pruned"],
      },
      review: {
        blockerCount: 0,
      },
    });
    expect(buildAssistantWorkflowToolSelectionMigrationReviewArtifactTracePayload(artifact)).toMatchObject({
      status: "ready_for_runtime_change",
      runtimeChange: {
        addIntentIds: ["answer_docs"],
        addSegmentKeys: ["answer_docs|hop:unknown|intent_pruned"],
      },
      evidence: {
        readyIntentCandidateKeys: ["answer_docs"],
      },
    });
  });

  it("blocks migration candidates until enough replay decisions exist", () => {
    const decision = serializeAssistantWorkflowToolSelectionDecision(buildAssistantWorkflowToolSelectionDecision({
      workflow: defineAssistantWorkflow(workflow()),
      classification: {
        intent: "answer_docs",
        toolsToExpose: ["query_docs"],
        entities: {},
      },
      availableToolNames: ["query_docs", "list_docs"],
      selectedToolNames: ["query_docs"],
      selectedReason: "intent_pruned",
      availableContext: ["document-scope"],
      workflowAuthorityIntentIds: ["value_lookup"],
    }));
    const report = buildAssistantWorkflowToolSelectionMigrationReport(
      buildAssistantWorkflowToolSelectionEvaluationBatch([decision]),
      { minDecisionCount: 2 },
    );

    expect(report).toMatchObject({
      minDecisionCount: 2,
      suggestedAuthorityIntentIds: [],
      readyIntentCandidates: [],
      reviewCandidates: expect.arrayContaining([
        expect.objectContaining({
          kind: "intent",
          intentId: "answer_docs",
          status: "needs_review",
          recommendedAction: "review_blockers_before_migration",
          blockingReasons: ["insufficient_decisions"],
        }),
      ]),
    });
    expect(buildAssistantWorkflowToolSelectionAuthorityAllowListProposal(report, {
      currentAuthorityIntentIds: ["answer_docs"],
      currentAuthoritySegmentKeys: ["answer_docs|hop:unknown|intent_pruned"],
    })).toMatchObject({
      addIntentIds: [],
      addSegmentKeys: [],
      keepIntentIds: ["answer_docs"],
      keepSegmentKeys: ["answer_docs|hop:unknown|intent_pruned"],
      proposedAuthorityIntentIds: ["answer_docs"],
      proposedAuthoritySegmentKeys: ["answer_docs|hop:unknown|intent_pruned"],
      reviewIntentIds: ["answer_docs"],
      reviewSegmentKeys: ["answer_docs|hop:unknown|intent_pruned"],
      currentIntentIdsWithReviewEvidence: ["answer_docs"],
      currentSegmentKeysWithReviewEvidence: ["answer_docs|hop:unknown|intent_pruned"],
      canApplyAdditions: false,
    });
  });

  it("aggregates evaluation batches with onlyInteresting filtering", () => {
    const workflowDefinition = defineAssistantWorkflow(workflow());
    const equivalentDecision = serializeAssistantWorkflowToolSelectionDecision(buildAssistantWorkflowToolSelectionDecision({
      workflow: workflowDefinition,
      classification: {
        intent: "answer_docs",
        toolsToExpose: ["query_docs"],
        entities: {},
      },
      availableToolNames: ["query_docs", "list_docs"],
      selectedToolNames: ["query_docs"],
      selectedReason: "intent_pruned",
      availableContext: ["document-scope"],
    }));
    const unavailableDecision = serializeAssistantWorkflowToolSelectionDecision(buildAssistantWorkflowToolSelectionDecision({
      workflow: workflowDefinition,
      classification: null,
      selectedToolNames: ["query_docs"],
      selectedReason: "intent_pruned",
    }));

    const batch = buildAssistantWorkflowToolSelectionEvaluationBatch([
      equivalentDecision,
      unavailableDecision,
    ], { onlyInteresting: true });

    expect(batch).toMatchObject({
      sourceDecisionCount: 2,
      rowCount: 1,
      interestingRowCount: 1,
      warningRowCount: 1,
      authoritySourceCounts: [{
        key: "legacy-pruner",
        count: 1,
      }],
      authorityReasonCounts: [{
        key: "workflow_unavailable",
        count: 1,
      }],
      signalCounts: [{
        name: "workflow_unavailable",
        severity: "warning",
        count: 1,
      }, {
        name: "legacy_authority",
        severity: "info",
        count: 1,
      }],
      rows: [{
        authorityReason: "workflow_unavailable",
        warningCount: 1,
      }],
      readinessSummary: {
        readyIntentCount: 0,
        confirmedIntentCount: 0,
        readySegmentCount: 0,
        confirmedSegmentCount: 0,
        warningIntentCount: 1,
        warningSegmentCount: 1,
      },
    });
    expect(buildAssistantWorkflowToolSelectionEvaluationBatchTracePayload(batch)).toMatchObject({
      rowCount: 1,
      warningRowCount: 1,
      readinessSummary: {
        warningIntentCount: 1,
        warningSegmentCount: 1,
      },
      signalCounts: [{
        name: "workflow_unavailable",
      }, {
        name: "legacy_authority",
      }],
    });
  });

  it("reports active selection profiles in row and batch evaluation payloads", () => {
    const decision = serializeAssistantWorkflowToolSelectionDecision(buildAssistantWorkflowToolSelectionDecision({
      workflow: defineAssistantWorkflow(workflow()),
      classification: {
        intent: "answer_docs",
        toolsToExpose: ["query_docs"],
        entities: {},
      },
      availableToolNames: ["query_docs", "list_docs", "search_docs"],
      selectedToolNames: ["query_docs", "list_docs", "search_docs"],
      selectedReason: "intent_pruned",
      hop: 1,
      availableContext: ["document-scope"],
    }));
    const evaluation = evaluateAssistantWorkflowToolSelectionDecision(decision);
    const batch = buildAssistantWorkflowToolSelectionEvaluationBatch([decision]);

    expect(evaluation).toMatchObject({
      workflowSelectionCandidateToolCount: 2,
      workflowSelectionActiveProfileIds: ["follow_up_retrieval"],
      workflowSelectionProfileToolNames: ["list_docs"],
      workflowSelectionProfileToolCount: 1,
      authorityReason: "workflow_differs",
    });
    expect(buildAssistantWorkflowToolSelectionEvaluationTracePayload(evaluation)).toMatchObject({
      workflowSelectionActiveProfileIds: ["follow_up_retrieval"],
      workflowSelectionProfileToolNames: ["list_docs"],
      workflowSelectionProfileToolCount: 1,
    });
    expect(batch).toMatchObject({
      workflowSelectionProfileCounts: [{
        key: "follow_up_retrieval",
        count: 1,
      }],
      workflowSelectionProfileToolCounts: [{
        key: "list_docs",
        count: 1,
      }],
    });
    expect(buildAssistantWorkflowToolSelectionEvaluationBatchTracePayload(batch)).toMatchObject({
      workflowSelectionProfileCounts: [{
        key: "follow_up_retrieval",
      }],
      workflowSelectionProfileToolCounts: [{
        key: "list_docs",
      }],
    });
  });

  it("builds a compact evaluation trace payload", () => {
    const decision = serializeAssistantWorkflowToolSelectionDecision(buildAssistantWorkflowToolSelectionDecision({
      workflow: defineAssistantWorkflow(workflow()),
      classification: null,
      selectedToolNames: ["query_docs"],
      selectedReason: "intent_pruned",
    }));
    const evaluation = evaluateAssistantWorkflowToolSelectionDecision(decision);

    expect(buildAssistantWorkflowToolSelectionEvaluationTracePayload(evaluation)).toMatchObject({
      authoritySource: "legacy-pruner",
      authorityReason: "workflow_unavailable",
      signalCount: 2,
      warningCount: 1,
      signals: [{
        name: "legacy_authority",
      }, {
        name: "workflow_unavailable",
      }],
    });
  });
});

function workflow(): AssistantWorkflowDefinition {
  return {
    id: "tool-selection-evaluation-agent",
    version: 1,
    intents: [{
      id: "answer_docs",
      description: "Answer docs.",
      defaultPresentation: "text",
      requiredToolHints: ["query_docs"],
      toolHints: ["list_docs"],
      toolSelectionProfiles: [{
        id: "follow_up_retrieval",
        description: "Expose broader retrieval tools after first-hop pruning.",
        condition: {
          minHop: 1,
          selectedReason: "intent_pruned",
        },
        toolHints: ["list_docs"],
      }],
      planningSteps: ["retrieve_docs"],
    }],
    tools: [{
      name: "query_docs",
      provider: "mcp",
      effect: "read",
      sideEffectRisk: "low",
      cacheability: "request-scoped",
      retryClass: "bounded",
      outputKinds: ["evidence"],
      requiredContext: ["document-scope"],
    }, {
      name: "list_docs",
      provider: "http",
      effect: "read",
      sideEffectRisk: "low",
      cacheability: "cacheable",
      retryClass: "safe",
      outputKinds: ["catalog"],
    }],
    toolBindings: [{
      name: "query_docs",
      provider: "mcp",
      serverId: "docs",
      toolName: "query",
    }, {
      name: "list_docs",
      provider: "http",
      path: "/docs",
    }],
    planningSteps: [{
      id: "retrieve_docs",
      description: "Retrieve docs.",
      kind: "retrieve",
      requiredToolHints: ["query_docs"],
      toolHints: ["list_docs"],
    }],
    presentations: [{
      id: "text",
      description: "Text response.",
    }],
  };
}
