// Slimmed: use generated dictionary as the source of attributes.
import { GeneratedAttributes, GeneratedAttributeDescriptions } from "./uns-dictionary.generated.js";
import { resolveAttributeDescription } from "./uns-dictionary-registry.js";
export const knownUnsAttributes = Object.values(GeneratedAttributes);
export const AttributeDescriptions = GeneratedAttributeDescriptions;
export function getAttributeDescription(name) {
    return (resolveAttributeDescription(name) ??
        AttributeDescriptions[name]);
}
//# sourceMappingURL=uns-attributes.js.map