// Simple registry to allow projects to provide additional descriptions at runtime
// without coupling core to project-generated files.

let objectTypeDescriptions: Record<string, string> = {};
let attributeDescriptions: Record<string, string> = {};

export function registerObjectTypeDescriptions(map: Record<string, string>): void {
  objectTypeDescriptions = { ...objectTypeDescriptions, ...map };
}

export function registerAttributeDescriptions(map: Record<string, string>): void {
  attributeDescriptions = { ...attributeDescriptions, ...map };
}

export function resolveObjectTypeDescription(name: string | undefined): string | undefined {
  if (!name) return undefined;
  return objectTypeDescriptions[name];
}

export function resolveAttributeDescription(name: string | undefined): string | undefined {
  if (!name) return undefined;
  return attributeDescriptions[name];
}
