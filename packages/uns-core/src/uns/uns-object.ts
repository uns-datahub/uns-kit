// Slimmed: use generated dictionary as the source of object types.
// Ensure generate-uns-dictionary is run (or provide your own generated file).
import { GeneratedObjectTypes, GeneratedObjectTypeDescriptions } from "./uns-dictionary.generated.js";
import { resolveObjectTypeDescription } from "./uns-dictionary-registry.js";

export const ObjectTypes = GeneratedObjectTypes;

export type KnownUnsObjectTypeName = keyof typeof GeneratedObjectTypes;

export type UnsObjectType = "" | KnownUnsObjectTypeName | (string & {});

// Default object id is "main" when none is provided.
export type UnsObjectId = "main" | "" | (string & {});

export function getObjectTypeDescription(objectType: UnsObjectType): string | undefined {
  return (
    resolveObjectTypeDescription(objectType) ??
    (GeneratedObjectTypeDescriptions as Record<string, string | undefined>)[objectType]
  );
}
