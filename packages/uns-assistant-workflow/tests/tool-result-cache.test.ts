import { describe, expect, it } from "vitest";
import {
  AssistantWorkflowToolResultCache,
  buildAssistantWorkflowToolResultCacheKey,
  chooseAssistantWorkflowToolResultCacheTtlMs,
} from "../src/index.js";

const NOW = Date.parse("2026-04-17T12:00:00Z");

describe("assistant workflow tool result cache", () => {
  it("chooses TTL by freshness of the `to` argument", () => {
    expect(chooseAssistantWorkflowToolResultCacheTtlMs({
      to: new Date(NOW - 60_000).toISOString(),
    }, NOW)).toBe(30_000);
    expect(chooseAssistantWorkflowToolResultCacheTtlMs({
      to: new Date(NOW - 30 * 60_000).toISOString(),
    }, NOW)).toBe(5 * 60_000);
    expect(chooseAssistantWorkflowToolResultCacheTtlMs({
      to: new Date(NOW - 12 * 60 * 60_000).toISOString(),
    }, NOW)).toBe(30 * 60_000);
    expect(chooseAssistantWorkflowToolResultCacheTtlMs({
      to: new Date(NOW - 7 * 24 * 60 * 60_000).toISOString(),
    }, NOW)).toBe(2 * 60 * 60_000);
    expect(chooseAssistantWorkflowToolResultCacheTtlMs({}, NOW)).toBe(15 * 60_000);
  });

  it("normalizes ISO timestamp args and configured unordered array args", () => {
    const k1 = buildAssistantWorkflowToolResultCacheKey("thread-1", "load_series", {
      from: "2026-04-17T10:00:00.000Z",
      topics: ["b", "a"],
    }, {
      sortArrayArgKeys: ["topics"],
    });
    const k2 = buildAssistantWorkflowToolResultCacheKey("thread-1", "load_series", {
      from: "2026-04-17T10:00:00Z",
      topics: ["a", "b"],
    }, {
      sortArrayArgKeys: ["topics"],
    });

    expect(k1).toBe(k2);
  });

  it("stores, hits, expires, and reports stats", () => {
    const cache = new AssistantWorkflowToolResultCache({
      cacheableToolNames: ["load_series"],
    });
    const args = { topic: "x", to: new Date(NOW - 60_000).toISOString() };

    expect(cache.get("thread-1", "load_series", args, NOW)).toBeNull();
    cache.set("thread-1", "load_series", args, "rows", NOW);
    expect(cache.get("thread-1", "load_series", args, NOW)).toBe("rows");
    expect(cache.get("thread-1", "load_series", args, NOW + 31_000)).toBeNull();
    expect(cache.getStats()).toMatchObject({
      hits: 1,
      misses: 2,
      expirations: 1,
      size: 0,
    });
  });

  it("does not cache tools outside the configured allow-list or error-looking values", () => {
    const cache = new AssistantWorkflowToolResultCache({
      cacheableToolNames: ["load_series"],
    });

    cache.set("thread-1", "search", {}, "result", NOW);
    expect(cache.get("thread-1", "search", {}, NOW)).toBeNull();
    cache.set("thread-1", "load_series", {}, "Error: unavailable", NOW);
    expect(cache.get("thread-1", "load_series", {}, NOW)).toBeNull();
  });

  it("evicts least-recently-used entries and clears by scope", () => {
    const cache = new AssistantWorkflowToolResultCache({
      maxEntries: 2,
      cacheableToolNames: ["resolve"],
    });

    cache.set("thread-1", "resolve", { x: 1 }, "A", NOW);
    cache.set("thread-1", "resolve", { x: 2 }, "B", NOW);
    cache.get("thread-1", "resolve", { x: 1 }, NOW);
    cache.set("thread-1", "resolve", { x: 3 }, "C", NOW);

    expect(cache.get("thread-1", "resolve", { x: 1 }, NOW)).toBe("A");
    expect(cache.get("thread-1", "resolve", { x: 2 }, NOW)).toBeNull();
    expect(cache.get("thread-1", "resolve", { x: 3 }, NOW)).toBe("C");
    expect(cache.getStats().evictions).toBe(1);

    cache.set("thread-2", "resolve", { x: 1 }, "D", NOW);
    cache.clearScope("thread-1");
    expect(cache.get("thread-1", "resolve", { x: 1 }, NOW)).toBeNull();
    expect(cache.get("thread-2", "resolve", { x: 1 }, NOW)).toBe("D");
  });
});
