// Slimmed: use generated dictionary as the source of attributes.
import { GeneratedAttributes, GeneratedAttributeDescriptions } from "./uns-dictionary.generated.js";
import { resolveAttributeDescription } from "./uns-dictionary-registry.js";

export const knownUnsAttributes = Object.values(GeneratedAttributes);

export type KnownUnsAttributeName = typeof GeneratedAttributes[keyof typeof GeneratedAttributes];

// Allow known attribute names while still allowing arbitrary strings.
export type UnsAttribute = "" | KnownUnsAttributeName | (string & {});

export const AttributeDescriptions = GeneratedAttributeDescriptions;

export function getAttributeDescription(name: string): string | undefined {
  return (
    resolveAttributeDescription(name) ??
    (AttributeDescriptions as Record<string, string | undefined>)[name]
  );
}
