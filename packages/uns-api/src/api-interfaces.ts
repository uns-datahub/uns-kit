export type {
  IApiProxyOptions,
  IGetEndpointOptions,
  IPostEndpointOptions,
  QueryParamDef,
} from "@uns-kit/core/uns/uns-interfaces.js";
import { buildUnsRoutePath } from "@uns-kit/core/uns/uns-path.js";
import type {
  IGetEndpointOptions,
  IPostEndpointOptions,
} from "@uns-kit/core/uns/uns-interfaces.js";

export type ApiInteractionMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type DataCatalogParameterRegistration = {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  description?: string | null;
  type?: string | null;
  format?: string | null;
  nullable?: boolean;
  example?: unknown;
  enumValues?: string[];
  schema?: unknown;
};

export type DataCatalogSchemaFieldRegistration = {
  name: string;
  path?: string;
  sourceKey?: string | null;
  type?: string | null;
  format?: string | null;
  nullable?: boolean;
  required?: boolean;
  description?: string | null;
  enumValues?: string[];
  example?: unknown;
};

export type DataCatalogSchemaRegistration = {
  id: string;
  title: string;
  kind?: string | null;
  source?: string | null;
  contentType?: string | null;
  rootType?: string | null;
  fieldPathPrefix?: string | null;
  nullable?: boolean;
  description?: string | null;
  fields?: DataCatalogSchemaFieldRegistration[];
  examplePayloads?: unknown[];
};

export type DataCatalogRequestBodyRegistration = {
  required?: boolean;
  description?: string | null;
  contentType?: string | null;
  schemas?: DataCatalogSchemaRegistration[];
  schemaIds?: string[];
};

export type DataCatalogResponseRegistration = {
  statusCode: string;
  description?: string | null;
  contentType?: string | null;
  schemas?: DataCatalogSchemaRegistration[];
  schemaIds?: string[];
  examplePayloads?: unknown[];
  headers?: DataCatalogParameterRegistration[];
};

export type DataCatalogOperationRegistration = {
  id?: string;
  method: ApiInteractionMethod | "HEAD" | "OPTIONS";
  path: string;
  summary?: string | null;
  description?: string | null;
  tags?: string[];
  deprecated?: boolean;
  parameters?: DataCatalogParameterRegistration[];
  headers?: DataCatalogParameterRegistration[];
  requestBody?: DataCatalogRequestBodyRegistration | null;
  responses?: DataCatalogResponseRegistration[];
};

export type DataCatalogOfferRegistration = {
  offerId: string;
  displayName: string;
  description?: string | null;
  owner?: string | null;
  status?: string | null;
  tags?: string[];
  categories?: string[];
  microserviceName?: string | null;
  version?: string | null;
  basePaths?: string[];
  operations: DataCatalogOperationRegistration[];
  schemas?: DataCatalogSchemaRegistration[];
  swaggerPath?: string | null;
  metadata?: Record<string, unknown> | null;
};

type ApiRouteIdentity<Handler = unknown> = {
  topic: string;
  asset: string;
  objectType: string;
  objectId: string;
  attribute: string;
  handler: Handler;
};

export type DataCatalogOfferSourceRegistration<Handler = unknown> = ApiRouteIdentity<Handler> & {
  offerId: string;
  displayName: string;
  description: string;
  owner?: string;
  status?: string;
  tags?: string[];
  categories?: string[];
  method?: ApiInteractionMethod;
  queryParams?: DataCatalogParameterRegistration[];
  headers?: DataCatalogParameterRegistration[];
  requestBody?: DataCatalogRequestBodyRegistration | null;
  response?: {
    statusCode?: string;
    description?: string | null;
    contentType?: string | null;
    headers?: DataCatalogParameterRegistration[];
    examplePayloads?: unknown[];
  };
  schema: DataCatalogSchemaRegistration;
  apiDescription?: string;
};

export type ServiceApiRegistration<Handler = unknown> = {
  attribute: string;
  handler: Handler;
  method?: ApiInteractionMethod;
  description: string;
  publishInUnsTree?: boolean;
  tags?: string[];
  queryParams?: DataCatalogParameterRegistration[];
  requestBody?: DataCatalogRequestBodyRegistration | null;
  response?: DataCatalogResponseRegistration;
  schema?: DataCatalogSchemaRegistration;
  topic?: string;
  asset?: string;
  objectType?: string;
  objectId?: string;
};

export type ApiInteractionDefinition<Handler = unknown> = {
  id: string;
  topic: string;
  asset: string;
  objectType: string;
  objectId: string;
  attribute: string;
  method: ApiInteractionMethod;
  routeOnly?: boolean;
  registryTopic?: "api-endpoints" | "service-endpoints" | "data-offer-endpoints";
  options: IGetEndpointOptions | IPostEndpointOptions;
  handler: Handler;
};

export function defineApiInteraction<Handler>(
  input: ApiInteractionDefinition<Handler>,
): ApiInteractionDefinition<Handler> {
  return input;
}

export function defineServiceApi<Handler>(
  input: ServiceApiRegistration<Handler>,
): ServiceApiRegistration<Handler> {
  return input;
}

export function buildApiInteractionPath(
  route: Pick<ApiInteractionDefinition, "topic" | "asset" | "objectType" | "objectId" | "attribute">,
  apiBasePrefix = "/api",
): string {
  return `${apiBasePrefix}${buildUnsRoutePath(route.topic, route.asset, route.objectType, route.objectId, route.attribute)}`.replace(
    /\/{2,}/g,
    "/",
  );
}

export function buildApiInteractionTopicPath(
  route: Pick<ApiInteractionDefinition, "topic" | "asset" | "objectType" | "objectId" | "attribute">,
): string {
  return buildUnsRoutePath(route.topic, route.asset, route.objectType, route.objectId, route.attribute).slice(1);
}

export function defineDataCatalogQueryParam(
  name: string,
  description: string,
  options: {
    required?: boolean;
    type?: string;
    format?: string;
    example?: unknown;
  } = {},
): DataCatalogParameterRegistration {
  return {
    name,
    in: "query",
    type: options.type ?? "string",
    required: options.required === true,
    description,
    ...(options.format ? { format: options.format } : {}),
    ...(options.example !== undefined ? { example: options.example } : {}),
  };
}

export function defineDataCatalogField(
  name: string,
  type: string,
  description: string,
  options: {
    path?: string;
    sourceKey?: string;
    required?: boolean;
    format?: string;
    nullable?: boolean;
    example?: unknown;
    enumValues?: string[];
  } = {},
): DataCatalogSchemaFieldRegistration {
  return {
    name,
    path: options.path ?? name,
    type,
    description,
    required: options.required === true,
    nullable: options.nullable === true,
    ...(options.format ? { format: options.format } : {}),
    ...(options.example !== undefined ? { example: options.example } : {}),
    ...(Array.isArray(options.enumValues) ? { enumValues: options.enumValues } : {}),
    ...(options.sourceKey ? { sourceKey: options.sourceKey } : {}),
  };
}

export function defineDataCatalogSchema(input: {
  id: string;
  title: string;
  contentType: string;
  description?: string;
  kind?: string;
  source?: string;
  rootType?: string;
  fieldPathPrefix?: string;
  fields: DataCatalogSchemaFieldRegistration[];
  examplePayloads?: unknown[];
}): DataCatalogSchemaRegistration {
  const fieldPathPrefix = input.fieldPathPrefix?.trim();
  const fields = input.fields.map((field) => ({
    ...field,
    path: field.path ?? buildSchemaFieldPath(field.name, field.type ?? "string", fieldPathPrefix),
  }));
  const shouldAutogenerateExamples = !isBinaryCatalogContentType(input.contentType);
  const examplePayloads =
    Array.isArray(input.examplePayloads) && input.examplePayloads.length
      ? input.examplePayloads
      : shouldAutogenerateExamples
        ? buildExamplePayloadsFromFields(fields)
        : [];
  return {
    id: input.id,
    title: input.title,
    kind: input.kind ?? "response",
    source: input.source ?? "registered",
    contentType: input.contentType,
    rootType: input.rootType ?? inferSchemaRootType(input.contentType, input.fields),
    ...(fieldPathPrefix ? { fieldPathPrefix } : {}),
    ...(input.description ? { description: input.description } : {}),
    fields,
    ...(examplePayloads?.length ? { examplePayloads } : {}),
  };
}

function isBinaryCatalogContentType(contentType: string | null | undefined): boolean {
  const normalized = String(contentType ?? "").toLowerCase();
  return normalized.includes("parquet") || normalized.includes("octet-stream");
}

export function buildDataCatalogOfferOperation(
  route: Pick<ApiInteractionDefinition, "topic" | "asset" | "objectType" | "objectId" | "attribute">,
  operation: Omit<DataCatalogOperationRegistration, "path">,
  apiBasePrefix = "/api",
): DataCatalogOperationRegistration {
  return {
    ...operation,
    path: buildApiInteractionPath(route, apiBasePrefix),
  };
}

export function defineDataCatalogOfferSource<Handler>(
  input: DataCatalogOfferSourceRegistration<Handler>,
): DataCatalogOfferSourceRegistration<Handler> {
  return input;
}

export function buildServiceApiInteractions<
  Handler,
  T extends Record<string, ServiceApiRegistration<Handler>>,
>(
  processName: string,
  definitions: T,
): Record<keyof T, ApiInteractionDefinition<Handler>> {
  return Object.fromEntries(
    Object.entries(definitions).map(([key, definition]) => [
      key,
      defineApiInteraction({
        id: String(key),
        topic: definition.topic ?? "system",
        asset: definition.asset ?? "service",
        objectType: definition.objectType ?? "runtime",
        objectId: definition.objectId ?? processName,
        attribute: definition.attribute,
        method: definition.method ?? "GET",
        routeOnly: definition.publishInUnsTree !== true,
        registryTopic: "service-endpoints",
        options: buildApiInteractionOptions(
          definition.method ?? "GET",
          definition.description,
          definition.tags,
          definition.queryParams,
          definition.requestBody,
          definition.publishInUnsTree !== true,
          "service-endpoints",
          buildServiceApiPayload(String(key), definition),
        ),
        handler: definition.handler,
      }),
    ]),
  ) as Record<keyof T, ApiInteractionDefinition<Handler>>;
}

export function buildApiInteractionsFromDataOfferSources<
  Handler,
  T extends Record<string, DataCatalogOfferSourceRegistration<Handler>>,
>(sources: T): Record<keyof T, ApiInteractionDefinition<Handler>> {
  return Object.fromEntries(
    Object.entries(sources).map(([key, source]) => [
      key,
      defineApiInteraction({
        id: source.offerId,
        topic: source.topic,
        asset: source.asset,
        objectType: source.objectType,
        objectId: source.objectId,
        attribute: source.attribute,
        method: source.method ?? "GET",
        routeOnly: true,
        registryTopic: "data-offer-endpoints",
        options: buildApiInteractionOptions(
          source.method ?? "GET",
          source.apiDescription ?? source.description,
          source.tags,
          source.queryParams,
          source.requestBody,
          true,
          "data-offer-endpoints",
        ),
        handler: source.handler,
      }),
    ]),
  ) as Record<keyof T, ApiInteractionDefinition<Handler>>;
}

export function buildDataCatalogOffersFromSources<
  T extends Record<string, DataCatalogOfferSourceRegistration<any>>,
>(sources: T): DataCatalogOfferRegistration[] {
  return Object.values(sources).map((source) => ({
    offerId: source.offerId,
    displayName: source.displayName,
    description: source.description,
    ...(source.owner ? { owner: source.owner } : {}),
    status: source.status ?? "available",
    ...(source.tags ? { tags: source.tags } : {}),
    ...(source.categories ? { categories: source.categories } : {}),
    schemas: [source.schema],
    operations: [
      buildDataCatalogOfferOperation(source as unknown as Pick<ApiInteractionDefinition, "topic" | "asset" | "objectType" | "objectId" | "attribute">, {
        id: `${source.offerId}-${(source.method ?? "GET").toLowerCase()}`,
        method: source.method ?? "GET",
        summary: source.displayName,
        description: source.description,
        ...(source.tags ? { tags: source.tags } : {}),
        ...(source.queryParams ? { parameters: source.queryParams } : {}),
        ...(source.headers ? { headers: source.headers } : {}),
        ...(source.requestBody !== undefined ? { requestBody: source.requestBody } : {}),
        responses: [
          {
            statusCode: source.response?.statusCode ?? "200",
            ...(source.response?.description ? { description: source.response.description } : { description: source.description }),
            contentType: source.response?.contentType ?? source.schema.contentType ?? null,
            schemas: [source.schema],
            ...(source.response?.examplePayloads ? { examplePayloads: source.response.examplePayloads } : {}),
            ...(source.response?.headers ? { headers: source.response.headers } : { headers: [] }),
          },
        ],
      }),
    ],
  }));
}

export function projectRowsForDataCatalogSchema(
  rows: Array<Record<string, unknown>>,
  schema: DataCatalogSchemaRegistration,
): Array<Record<string, unknown>> {
  const leafFields = (schema.fields ?? []).filter((field) => field.type !== "array");
  return rows.map((row) => {
    const projected: Record<string, unknown> = {};
    for (const field of leafFields) {
      const outputKey = field.name;
      const sourceKey = field.sourceKey?.trim() || field.name;
      projected[outputKey] = getRowValue(row, sourceKey);
    }
    return projected;
  });
}

export function buildSchemaFieldPathIndex(schema: DataCatalogSchemaRegistration): Array<{ path: string; name: string }> {
  return (schema.fields ?? []).map((field) => ({
    path: field.path ?? field.name,
    name: field.name,
  }));
}

function inferSchemaRootType(
  contentType: string,
  fields: DataCatalogSchemaFieldRegistration[],
): string {
  if (contentType.includes("parquet") || contentType.includes("octet-stream")) {
    return "table";
  }
  if (fields.some((field) => (field.path ?? field.name).includes("[]"))) {
    return "object";
  }
  return "object";
}

function buildSchemaFieldPath(name: string, type: string, fieldPathPrefix?: string): string {
  if (fieldPathPrefix && type !== "array") {
    return `${fieldPathPrefix}.${name}`;
  }
  return name;
}

function buildApiInteractionOptions(
  method: ApiInteractionMethod,
  description: string,
  tags?: string[],
  queryParams?: DataCatalogParameterRegistration[],
  requestBody?: DataCatalogRequestBodyRegistration | null,
  routeOnly = true,
  registryTopic: "api-endpoints" | "service-endpoints" | "data-offer-endpoints" = "api-endpoints",
  serviceApi?: Record<string, unknown>,
): IGetEndpointOptions | IPostEndpointOptions {
  if (method === "GET") {
    return {
      apiDescription: description,
      ...(routeOnly ? { routeOnly: true } : {}),
      ...(registryTopic ? { registryTopic } : {}),
      ...(serviceApi ? { serviceApi } : {}),
      ...(tags ? { tags } : {}),
      ...(queryParams
        ? {
            queryParams: queryParams
              .filter((parameter) => parameter.in === "query")
              .map((parameter) => ({
                name: parameter.name,
                type:
                  parameter.type === "number" || parameter.type === "boolean"
                    ? parameter.type
                    : "string",
                required: parameter.required,
                ...(parameter.description ? { description: parameter.description } : {}),
              })),
          }
        : {}),
    } as IGetEndpointOptions;
  }

  const requestSchema = requestBody?.schemas?.[0]
    ? buildJsonSchemaFromCatalogSchema(requestBody.schemas[0])
    : null;
  return {
    apiDescription: description,
    ...(routeOnly ? { routeOnly: true } : {}),
    ...(registryTopic ? { registryTopic } : {}),
    ...(serviceApi ? { serviceApi } : {}),
    ...(tags ? { tags } : {}),
    ...(requestBody
      ? {
          requestBody: {
            required: requestBody.required ?? true,
            ...(requestBody.description ? { description: requestBody.description } : {}),
            ...(requestSchema && typeof requestSchema === "object" ? { schema: requestSchema as Record<string, unknown> } : {}),
          },
        }
      : {}),
  } as IPostEndpointOptions;
}

function buildServiceApiPayload<Handler>(
  id: string,
  definition: ServiceApiRegistration<Handler>,
): Record<string, unknown> {
  const schemas = definition.schema ? [definition.schema] : [];
  const response = definition.response ?? {
    statusCode: "200",
    description: definition.description,
    ...(definition.schema?.contentType ? { contentType: definition.schema.contentType } : {}),
    ...(definition.schema ? { schemas: [definition.schema] } : {}),
  };

  return {
    id,
    summary: definition.description,
    description: definition.description,
    tags: definition.tags ?? [],
    parameters: definition.queryParams ?? [],
    headers: [],
    requestBody: definition.requestBody ?? null,
    responses: [response],
    schemas,
  };
}

function getRowValue(row: Record<string, unknown>, key: string): unknown {
  if (Object.prototype.hasOwnProperty.call(row, key)) {
    return row[key];
  }
  const normalizedKey = key.toLowerCase();
  const match = Object.keys(row).find((candidate) => candidate.toLowerCase() === normalizedKey);
  return match ? row[match] : null;
}

function buildJsonSchemaFromCatalogSchema(schema: DataCatalogSchemaRegistration): Record<string, unknown> {
  const leafFields = (schema.fields ?? []).filter((field) => field.type !== "array");
  const properties = Object.fromEntries(
    leafFields.map((field) => [
      field.name,
      {
        type: toJsonSchemaType(field.type ?? "string"),
        ...(field.description ? { description: field.description } : {}),
        ...(field.format ? { format: field.format } : {}),
        ...(field.example !== undefined ? { example: field.example } : {}),
        ...(Array.isArray(field.enumValues) && field.enumValues.length ? { enum: field.enumValues } : {}),
      },
    ]),
  );
  const required = leafFields.filter((field) => field.required === true).map((field) => field.name);

  return {
    type: "object",
    ...(required.length ? { required } : {}),
    properties,
  };
}

function toJsonSchemaType(type: string): string {
  switch (type) {
    case "number":
    case "integer":
    case "boolean":
    case "array":
    case "object":
      return type;
    default:
      return "string";
  }
}

function buildExamplePayloadsFromFields(
  fields: DataCatalogSchemaFieldRegistration[],
): unknown[] | undefined {
  const arrayFields = fields.filter((field) => field.type === "array");
  const scalarFields = fields.filter((field) => field.type !== "array");

  if (!scalarFields.length) {
    return undefined;
  }

  if (arrayFields.length === 1 && isGenericListField(arrayFields[0].name)) {
    const listField = arrayFields[0];
    const rowFields = scalarFields.filter((field) => field.name !== "count");
    if (!rowFields.length || rowFields.some((field) => field.example === undefined)) {
      return undefined;
    }

    const payload: Record<string, unknown> = {
      [listField.name]: [Object.fromEntries(rowFields.map((field) => [field.name, field.example]))],
    };
    const countField = scalarFields.find((field) => field.name === "count");
    if (countField) {
      payload[countField.name] = countField.example ?? 1;
    }
    return [payload];
  }

  if (scalarFields.some((field) => field.example === undefined)) {
    return undefined;
  }

  return [Object.fromEntries(scalarFields.map((field) => [field.name, field.example]))];
}

function isGenericListField(name: string): boolean {
  return name === "data" || name === "rows";
}
