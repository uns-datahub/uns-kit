import { describe, expect, it } from "vitest";
import {
  matchesAssistantWorkflowToolEvidenceBinding,
  parseAssistantWorkflowToolEvidence,
  supportsAssistantWorkflowToolEvidence,
} from "../src/index.js";

const envelope = () => ({
  format: "example.tool-evidence",
  formatVersion: 1,
  invocationId: "fetch_record:read_record",
  toolName: "read_record",
  callId: "run-1:workflow:fetch_record:read_record",
  issuedAt: "2026-07-14T12:00:00.000Z",
  expiresAt: "2099-07-14T12:01:00.000Z",
  data: { recordId: "record-1", state: "ready" },
});

const options = {
  format: "example.tool-evidence",
  formatVersion: 1,
  parseData: (value: unknown): { recordId: string; state: string } | null => {
    if (!isRecord(value) || typeof value["recordId"] !== "string" || typeof value["state"] !== "string") return null;
    return { recordId: value["recordId"], state: value["state"] };
  },
};

describe("assistant workflow tool evidence", () => {
  it("parses a versioned envelope while leaving domain data validation to the host", () => {
    expect(parseAssistantWorkflowToolEvidence(envelope(), options)).toEqual(envelope());
    expect(parseAssistantWorkflowToolEvidence({ ...envelope(), data: { recordId: 1 } }, options)).toBeNull();
  });

  it("requires an exact, unexpired delegated invocation binding", () => {
    const evidence = parseAssistantWorkflowToolEvidence(envelope(), options);
    if (!evidence) throw new Error("test evidence did not parse");
    expect(matchesAssistantWorkflowToolEvidenceBinding(evidence, {
      invocationId: "fetch_record:read_record",
      toolName: "read_record",
      callId: "run-1:workflow:fetch_record:read_record",
      expiresAt: "2099-07-14T12:01:00.000Z",
    }, Date.parse("2026-07-14T12:00:30.000Z"))).toBe(true);
    expect(matchesAssistantWorkflowToolEvidenceBinding(evidence, {
      invocationId: "other:read_record",
      toolName: "read_record",
      callId: "run-1:workflow:fetch_record:read_record",
      expiresAt: "2099-07-14T12:01:00.000Z",
    }, Date.parse("2026-07-14T12:00:30.000Z"))).toBe(false);
    expect(matchesAssistantWorkflowToolEvidenceBinding(evidence, {
      invocationId: "fetch_record:read_record",
      toolName: "read_record",
      callId: "run-1:workflow:fetch_record:read_record",
      expiresAt: "2099-07-14T12:01:00.000Z",
    }, Date.parse("2100-07-14T12:00:30.000Z"))).toBe(false);
  });

  it("checks only the generic contract format/version and tool allowlist", () => {
    expect(supportsAssistantWorkflowToolEvidence({
      format: "example.tool-evidence",
      formatVersion: 1,
      toolNames: ["read_record"],
    }, "read_record")).toBe(true);
    expect(supportsAssistantWorkflowToolEvidence({
      format: "example.tool-evidence",
      formatVersion: 0,
      toolNames: ["read_record"],
    }, "read_record")).toBe(false);
    expect(supportsAssistantWorkflowToolEvidence({
      format: "example.tool-evidence",
      formatVersion: 1,
      toolNames: ["read_record"],
    }, "write_record")).toBe(false);
  });
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
