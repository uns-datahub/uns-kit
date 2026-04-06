// Simple registry to allow projects to provide additional descriptions at runtime
// without coupling core to project-generated files.
let objectTypeDescriptions = {};
let attributeDescriptions = {};
export function registerObjectTypeDescriptions(map) {
    objectTypeDescriptions = { ...objectTypeDescriptions, ...map };
}
export function registerAttributeDescriptions(map) {
    attributeDescriptions = { ...attributeDescriptions, ...map };
}
export function resolveObjectTypeDescription(name) {
    if (!name)
        return undefined;
    return objectTypeDescriptions[name];
}
export function resolveAttributeDescription(name) {
    if (!name)
        return undefined;
    return attributeDescriptions[name];
}
//# sourceMappingURL=uns-dictionary-registry.js.map