import { z } from "zod";

// Helper functions in camelCase
function shapeKeys(obj: z.AnyZodObject) {
  const shape = (obj as any)?._def?.shape();
  return Object.keys(shape ?? {});
}

// Function in camelCase is fine
export function composeConfigSchema(
  core: z.AnyZodObject,
  ...extras: z.AnyZodObject[]
): z.AnyZodObject {
  const coreKeys = new Set(shapeKeys(core));
  for (const ext of extras) {
    const keys = shapeKeys(ext);
    const overlaps = keys.filter(k => coreKeys.has(k));
    if (overlaps.length) {
      throw new Error(`Project extras overlap UNS core keys: ${overlaps.join(", ")}`);
    }
    keys.forEach(k => coreKeys.add(k));
  }
  return extras.reduce((acc, ext) => acc.merge(ext), core);
}
