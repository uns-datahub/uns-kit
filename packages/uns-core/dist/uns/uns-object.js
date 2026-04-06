// Slimmed: use generated dictionary as the source of object types.
// Ensure generate-uns-dictionary is run (or provide your own generated file).
import { GeneratedObjectTypes, GeneratedObjectTypeDescriptions } from "./uns-dictionary.generated.js";
import { resolveObjectTypeDescription } from "./uns-dictionary-registry.js";
export const ObjectTypes = GeneratedObjectTypes;
export function getObjectTypeDescription(objectType) {
    return (resolveObjectTypeDescription(objectType) ??
        GeneratedObjectTypeDescriptions[objectType]);
}
//# sourceMappingURL=uns-object.js.map