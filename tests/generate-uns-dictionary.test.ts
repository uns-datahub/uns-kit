import { describe, expect, it } from "vitest";

import { renderDictionaryTs } from "../packages/uns-core/src/tools/generate-uns-dictionary.js";

describe("generate-uns-dictionary", () => {
  it("includes object membership attributes in GeneratedAttributesByType", () => {
    const output = renderDictionaryTs(
      {
        objectTypes: {
          "meter-type": {
            description: "Meter",
            attributes: [
              { key: "volume", sortOrder: 10 },
              { attributeKey: "pressure", sortOrder: 20 },
            ],
          },
        },
        attributes: {
          pressure: { description: "Pressure" },
          volume: { description: "Volume" },
        },
      },
      "sl",
    );

    expect(output).toContain('  "meter-type": {');
    expect(output).toContain('    "volume": "volume",');
    expect(output).toContain('    "pressure": "pressure",');
  });
});
