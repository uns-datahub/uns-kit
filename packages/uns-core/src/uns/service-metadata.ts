import { PACKAGE_INFO } from "./process-config.js";

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

function cleanOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function cleanStringList(values: string[] | undefined): string[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
}

function cleanApiRoutes(routes: UnsServiceApiRouteMetadata[] | undefined): UnsServiceApiRouteMetadata[] {
  return (routes ?? [])
    .map((route) => ({
      ...route,
      path: route.path.trim(),
      healthPath: cleanOptionalString(route.healthPath),
      swaggerPath: cleanOptionalString(route.swaggerPath),
    }))
    .filter((route) => route.path.length > 0);
}

export function buildUnsServiceMetadata(input: {
  processName: string;
  processId: string;
  metadata: UnsServiceMetadataInput;
  now?: Date;
}): UnsServiceMetadata {
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
    controller:
      controller && (controller.name || controller.publicBase)
        ? controller
        : undefined,
    extra: input.metadata.extra,
    publishedAt: (input.now ?? new Date()).toISOString(),
  };
}
