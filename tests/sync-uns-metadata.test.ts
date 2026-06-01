import { describe, expect, it } from "vitest";
import {
  extractBaseTopicPath,
  renderUnsAssetsTs,
  renderUnsTagsTs,
  renderUnsTopicsTs,
} from "../packages/uns-core/src/tools/sync-uns-metadata.js";

describe("sync-uns-metadata renderers", () => {
  it("renders normalized topic unions", () => {
    expect(renderUnsTopicsTs(["plant/line", "/plant/area/", "plant/line/"])).toBe(
      "// Generated UNS topic union. Run `pnpm run sync-uns-metadata` to update.\n" +
      "export type UnsTopics =\n" +
      "  | \"plant/area/\"\n" +
      "  | \"plant/line/\"\n" +
      "  | (string & {});\n"
    );
  });

  it("extracts base topics from exported full topic paths using known assets", () => {
    const assets = ["hrm-furnace", "asset-with/segments"];

    expect(extractBaseTopicPath("sij/acroni/vv/hrm-furnace/equipment/zone-1/temperature", assets)).toBe(
      "sij/acroni/vv/",
    );
    expect(extractBaseTopicPath("/plant/area/asset-with/segments/motor/main/current/", assets)).toBe(
      "plant/area/",
    );
    expect(extractBaseTopicPath("plant/hrm-furnace/hrm-furnace/equipment/zone-1/temperature", assets)).toBe(
      "plant/hrm-furnace/",
    );
    expect(extractBaseTopicPath("plant/area/base-only", assets)).toBe("plant/area/base-only/");
  });

  it("renders tag unions", () => {
    expect(renderUnsTagsTs(["quality", "energy", "quality"])).toBe(
      "// Generated UNS tag union. Run `pnpm run sync-uns-metadata` to update.\n" +
      "export type UnsTags =\n" +
      "  | \"energy\"\n" +
      "  | \"quality\"\n" +
      "  | (string & {});\n"
    );
  });

  it("renders asset constants with descriptions", () => {
    expect(renderUnsAssetsTs([
      { name: "line-1", description: "Line 1 */ safe" },
      { name: "plant", description: null },
    ])).toContain("  /** Line 1 *\\/ safe */\n  \"line-1\": \"line-1\",");
  });
});
