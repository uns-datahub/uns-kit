import { describe, expect, it } from "vitest";
import {
  getAssistantWorkflowPolicyValueSource,
  hasAssistantWorkflowBooleanPolicyValue,
  hasAssistantWorkflowPolicyOverride,
  hasAssistantWorkflowStringPolicyValue,
  normalizeAssistantWorkflowPolicyBaseUrl,
  normalizeAssistantWorkflowPolicyString,
  resolveAssistantWorkflowPolicyValue,
  type AssistantWorkflowPolicyValuePresence,
} from "../src/index.js";

type TestPolicy = {
  enabled: boolean;
  profile: string | null;
};

type TestPolicyOverride = {
  enabled?: boolean | null;
  profile?: string | null;
};

const hasEnabled: AssistantWorkflowPolicyValuePresence<TestPolicyOverride> = (value) =>
  hasAssistantWorkflowBooleanPolicyValue(value?.enabled);
const hasProfile: AssistantWorkflowPolicyValuePresence<TestPolicyOverride> = (value) =>
  hasAssistantWorkflowStringPolicyValue(value?.profile);

describe("assistant workflow policy resolution", () => {
  it("normalizes strings and base URLs", () => {
    expect(normalizeAssistantWorkflowPolicyString(" profile ")).toBe("profile");
    expect(normalizeAssistantWorkflowPolicyString(" ")).toBeNull();
    expect(normalizeAssistantWorkflowPolicyBaseUrl(" https://api.example.test/// ")).toBe("https://api.example.test");
  });

  it("resolves effective values from override when present", () => {
    const defaults: TestPolicy = { enabled: false, profile: null };

    expect(resolveAssistantWorkflowPolicyValue(defaults, { enabled: true }, (value) => value.enabled, hasEnabled))
      .toBe(true);
    expect(resolveAssistantWorkflowPolicyValue(defaults, {}, (value) => value.enabled, hasEnabled))
      .toBe(false);
  });

  it("reports value source across config and runtime overrides", () => {
    expect(getAssistantWorkflowPolicyValueSource<TestPolicyOverride>(
      { profile: "config" },
      { profile: "runtime" },
      hasProfile,
    )).toBe("db_override");
    expect(getAssistantWorkflowPolicyValueSource<TestPolicyOverride>(
      { profile: "config" },
      {},
      hasProfile,
    )).toBe("config");
    expect(getAssistantWorkflowPolicyValueSource<TestPolicyOverride>(
      {},
      {},
      hasProfile,
    )).toBe("default");
  });

  it("detects meaningful overrides with supplied presence checks", () => {
    expect(hasAssistantWorkflowPolicyOverride<TestPolicyOverride>(
      { profile: "runtime" },
      [hasEnabled, hasProfile],
    )).toBe(true);
    expect(hasAssistantWorkflowPolicyOverride<TestPolicyOverride>(
      { profile: " " },
      [hasEnabled, hasProfile],
    )).toBe(false);
  });
});
