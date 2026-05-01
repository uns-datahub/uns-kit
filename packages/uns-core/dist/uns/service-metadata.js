import { PACKAGE_INFO } from "./process-config.js";
function cleanOptionalString(value) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}
function cleanStringList(values) {
    return Array.from(new Set((values ?? [])
        .map((value) => value.trim())
        .filter((value) => value.length > 0)));
}
function cleanApiRoutes(routes) {
    return (routes ?? [])
        .map((route) => ({
        ...route,
        path: route.path.trim(),
        healthPath: cleanOptionalString(route.healthPath),
        swaggerPath: cleanOptionalString(route.swaggerPath),
    }))
        .filter((route) => route.path.length > 0);
}
export function buildUnsServiceMetadata(input) {
    const serviceId = input.metadata.serviceId.trim();
    if (!serviceId) {
        throw new Error("Uns service metadata requires a serviceId.");
    }
    const packageName = cleanOptionalString(input.metadata.packageName) ?? PACKAGE_INFO.name;
    const packageVersion = cleanOptionalString(input.metadata.packageVersion) ?? PACKAGE_INFO.version;
    const controller = input.metadata.controller
        ? {
            name: cleanOptionalString(input.metadata.controller.name),
            publicBase: cleanOptionalString(input.metadata.controller.publicBase),
        }
        : undefined;
    return {
        schemaVersion: 1,
        serviceId,
        kind: input.metadata.kind,
        addonId: cleanOptionalString(input.metadata.addonId),
        label: cleanOptionalString(input.metadata.label),
        description: cleanOptionalString(input.metadata.description),
        packageName,
        packageVersion,
        processName: input.processName,
        processId: input.processId,
        instanceId: cleanOptionalString(input.metadata.instanceId),
        capabilities: cleanStringList(input.metadata.capabilities),
        apiRoutes: cleanApiRoutes(input.metadata.apiRoutes),
        healthPath: cleanOptionalString(input.metadata.healthPath),
        controller: controller && (controller.name || controller.publicBase)
            ? controller
            : undefined,
        extra: input.metadata.extra,
        publishedAt: (input.now ?? new Date()).toISOString(),
    };
}
//# sourceMappingURL=service-metadata.js.map