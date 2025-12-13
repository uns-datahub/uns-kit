// Slimmed: use generated dictionary as the source of object types.
// Ensure generate-uns-dictionary is run (or provide your own generated file).
import { GeneratedObjectTypes } from "./uns-dictionary.generated.js";

export const ObjectTypes = GeneratedObjectTypes;

export type KnownUnsObjectTypeName = keyof typeof GeneratedObjectTypes;

export type UnsObjectType = "" | KnownUnsObjectTypeName | (string & {});

// Default object id is "main" when none is provided.
export type UnsObjectId = "main" | "" | (string & {});
