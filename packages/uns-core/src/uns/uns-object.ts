// Extend this list to add curated IntelliSense hints for object types.
// Based on ISA-95-aligned categories plus commonly used UNS structural nodes.
export const knownUnsObjectTypes = [
  // ISA-95-aligned types
  "equipment",
  "material",
  "personnel",
  "process-segment",
  "product-definition",
  "product-quality",
  "work-definition",
  "resource-status",
  "energy-resource",
  "utility-resource",
  "fluid-resource",
  "consumable-resource",
  // Common structural or legacy types used in templates/examples
  "line",
  "area",
  "site",
  "enterprise",
  "asset",
  "sensor",
] as const;

export type UnsObjectType = "" | typeof knownUnsObjectTypes[number] | (string & {});

// Default object id is "main" when none is provided.
export type UnsObjectId = "main" | "" | (string & {});
