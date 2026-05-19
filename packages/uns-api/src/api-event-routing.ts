import type { UnsEvents } from "@uns-kit/core/uns/uns-interfaces.js";
import type {
  ApiInteractionDefinition,
  ApiInteractionMethod,
  DataCatalogOfferRegistration,
  DataCatalogOfferSourceRegistration,
  ServiceApiRegistration,
} from "./api-interfaces.js";
import {
  buildApiInteractionTopicPath,
  buildApiInteractionsFromDataOfferSources,
  buildDataCatalogOffersFromSources,
  buildServiceApiInteractions,
} from "./api-interfaces.js";
import type UnsApiProxy from "./uns-api-proxy.js";

type ApiEventNameByMethod = {
  GET: "apiGetEvent";
  POST: "apiPostEvent";
  PUT: "apiPutEvent";
  PATCH: "apiPatchEvent";
  DELETE: "apiDeleteEvent";
};

type ApiEventEnvelope = { req: any; res: any };

type ApiEventByMethod = {
  GET: UnsEvents["apiGetEvent"];
  POST: UnsEvents["apiPostEvent"];
  PUT: ApiEventEnvelope;
  PATCH: ApiEventEnvelope;
  DELETE: ApiEventEnvelope;
};

export type ApiHandler<Method extends ApiInteractionMethod = ApiInteractionMethod, Context = void> = (
  event: ApiEventByMethod[Method],
  context: Context,
) => Promise<void>;

export type RegisterApiEventsOptions = {
  notFoundMessage?: string;
  onError?: (input: { method: ApiInteractionMethod; reqPath?: string; error: unknown }) => void;
};

export type RegisterApiCatalogOptions<
  Context,
  Handler,
  ServiceApis extends Record<string, ServiceApiRegistration<Handler>>,
  OfferSources extends Record<string, DataCatalogOfferSourceRegistration<Handler>>,
> = {
  serviceApis?: ServiceApis;
  dataOfferSources?: OfferSources;
  context: Context;
  dataCatalogOffers?: DataCatalogOfferRegistration[];
  options?: RegisterApiEventsOptions;
};

const EVENT_NAME_BY_METHOD: ApiEventNameByMethod = {
  GET: "apiGetEvent",
  POST: "apiPostEvent",
  PUT: "apiPutEvent",
  PATCH: "apiPatchEvent",
  DELETE: "apiDeleteEvent",
};

export function normalizeApiRequestPath(path?: string): string | undefined {
  const normalized = path?.replace(/^\/+|\/+$/g, "");
  return normalized?.length ? normalized : undefined;
}

export async function registerApiCatalog<
  Context,
  Handler,
  ServiceApis extends Record<string, ServiceApiRegistration<Handler>>,
  OfferSources extends Record<string, DataCatalogOfferSourceRegistration<Handler>>,
>(
  apiInput: UnsApiProxy,
  input: RegisterApiCatalogOptions<Context, Handler, ServiceApis, OfferSources>,
): Promise<{
  serviceApiRoutes: ApiInteractionDefinition<Handler>[];
  dataOfferRoutes: ApiInteractionDefinition<Handler>[];
  dataCatalogOffers: DataCatalogOfferRegistration[];
}> {
  const serviceApiRoutes = Object.values(
    buildServiceApiInteractions(apiInput.getProcessName(), input.serviceApis ?? ({} as ServiceApis)),
  ) as ApiInteractionDefinition<Handler>[];
  const dataOfferRoutes = Object.values(
    buildApiInteractionsFromDataOfferSources(input.dataOfferSources ?? ({} as OfferSources)),
  ) as ApiInteractionDefinition<Handler>[];
  const dataCatalogOffers = input.dataCatalogOffers ?? buildDataCatalogOffersFromSources(input.dataOfferSources ?? ({} as OfferSources));
  const allRoutes = [...serviceApiRoutes, ...dataOfferRoutes];

  await registerApiInteractions(apiInput, allRoutes);
  for (const offer of dataCatalogOffers) {
    apiInput.registerDataOffer(offer);
  }
  registerApiEvents(apiInput, allRoutes, input.context, input.options);

  return { serviceApiRoutes, dataOfferRoutes, dataCatalogOffers };
}

export async function registerApiInteractions<Handler>(
  apiInput: UnsApiProxy,
  routes: ApiInteractionDefinition<Handler>[],
): Promise<void> {
  for (const route of routes) {
    switch (route.method) {
      case "GET":
        await apiInput.get(route.topic, route.asset as any, route.objectType as any, route.objectId as any, route.attribute as any, route.options as any);
        break;
      case "POST":
        await apiInput.post(route.topic, route.asset as any, route.objectType as any, route.objectId as any, route.attribute as any, route.options as any);
        break;
      case "PUT":
        await apiInput.put(route.topic, route.asset as any, route.objectType as any, route.objectId as any, route.attribute as any, route.options as any);
        break;
      case "PATCH":
        await apiInput.patch(route.topic, route.asset as any, route.objectType as any, route.objectId as any, route.attribute as any, route.options as any);
        break;
      case "DELETE":
        await apiInput.delete(route.topic, route.asset as any, route.objectType as any, route.objectId as any, route.attribute as any, route.options as any);
        break;
      default:
        throw new Error(`Unsupported API method: ${(route as ApiInteractionDefinition).method}`);
    }
  }
}

export function registerApiEvents<Context, Handler>(
  apiInput: UnsApiProxy,
  routes: ApiInteractionDefinition<Handler>[],
  context: Context,
  options: RegisterApiEventsOptions = {},
): void {
  const handlersByMethod = buildRouteHandlerIndex(routes);
  bindMethodEvent(apiInput, "GET", handlersByMethod.GET, context, options);
  bindMethodEvent(apiInput, "POST", handlersByMethod.POST, context, options);
  bindMethodEvent(apiInput, "PUT", handlersByMethod.PUT, context, options);
  bindMethodEvent(apiInput, "PATCH", handlersByMethod.PATCH, context, options);
  bindMethodEvent(apiInput, "DELETE", handlersByMethod.DELETE, context, options);
}

function buildRouteHandlerIndex<Handler>(routes: ApiInteractionDefinition<Handler>[]) {
  return routes.reduce(
    (acc, route) => {
      acc[route.method][buildApiInteractionTopicPath(route)] = route.handler;
      return acc;
    },
    {
      GET: {} as Record<string, Handler>,
      POST: {} as Record<string, Handler>,
      PUT: {} as Record<string, Handler>,
      PATCH: {} as Record<string, Handler>,
      DELETE: {} as Record<string, Handler>,
    },
  );
}

function bindMethodEvent<Context, Method extends ApiInteractionMethod, Handler>(
  apiInput: UnsApiProxy,
  method: Method,
  handlers: Record<string, Handler>,
  context: Context,
  options: RegisterApiEventsOptions,
): void {
  const eventName = EVENT_NAME_BY_METHOD[method];
  apiInput.event.on(eventName as any, async (event: ApiEventByMethod[Method]) => {
    const reqPath = normalizeApiRequestPath((event as any).req.path);
    const handler = reqPath ? handlers[reqPath] : undefined;
    await executeHandler(event, handler as any, context, method, reqPath, options);
  });
}

async function executeHandler<TEvent, Context>(
  event: TEvent & { res: { status: (code: number) => { send: (value: string) => void } } },
  handler: ((event: TEvent, context: Context) => Promise<void>) | undefined,
  context: Context,
  method: ApiInteractionMethod,
  reqPath: string | undefined,
  options: RegisterApiEventsOptions,
): Promise<void> {
  if (!handler) {
    event.res.status(404).send(options.notFoundMessage ?? "API handler not found");
    return;
  }

  try {
    await handler(event, context);
  } catch (error) {
    options.onError?.({ method, reqPath, error });
    event.res.status(500).send("Server error");
  }
}
