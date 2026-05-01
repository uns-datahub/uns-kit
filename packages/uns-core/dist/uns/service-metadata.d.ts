export type UnsServiceKind = "core" | "addon" | "capability" | "service";
export type UnsServiceApiRouteKind = "api-route" | "api-catchall" | "health" | "swagger";
export interface UnsServiceApiRouteMetadata {
    path: string;
    kind?: UnsServiceApiRouteKind;
    healthPath?: string;
    swaggerPath?: string;
}
export interface UnsServiceControllerMetadata {
    name?: string;
    publicBase?: string;
}
export interface UnsServiceMetadataInput {
    serviceId: string;
    kind: UnsServiceKind;
    addonId?: string;
    label?: string;
    description?: string;
    capabilities?: string[];
    apiRoutes?: UnsServiceApiRouteMetadata[];
    healthPath?: string;
    controller?: UnsServiceControllerMetadata;
    instanceId?: string;
    packageName?: string;
    packageVersion?: string;
    extra?: Record<string, unknown>;
}
export interface UnsServiceMetadata {
    schemaVersion: 1;
    serviceId: string;
    kind: UnsServiceKind;
    addonId?: string;
    label?: string;
    description?: string;
    packageName: string;
    packageVersion: string;
    processName: string;
    processId: string;
    instanceId?: string;
    capabilities: string[];
    apiRoutes: UnsServiceApiRouteMetadata[];
    healthPath?: string;
    controller?: UnsServiceControllerMetadata;
    extra?: Record<string, unknown>;
    publishedAt: string;
}
export declare function buildUnsServiceMetadata(input: {
    processName: string;
    processId: string;
    metadata: UnsServiceMetadataInput;
    now?: Date;
}): UnsServiceMetadata;
//# sourceMappingURL=service-metadata.d.ts.map