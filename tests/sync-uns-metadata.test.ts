import { describe, expect, it } from "vitest";
import {
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
