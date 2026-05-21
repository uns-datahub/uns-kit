from __future__ import annotations

from typing import Any, Callable, Mapping

from .interfaces import (
    ApiInteractionDefinition,
    ApiInteractionMethod,
    DataCatalogOfferRegistration,
    DataCatalogOfferSourceRegistration,
    ServiceApiRegistration,
    build_api_interaction_topic_path,
    build_api_interactions_from_data_offer_sources,
    build_data_catalog_offers_from_sources,
    build_service_api_interactions,
)
from .proxy import UnsApiProxy

ApiHandler = Callable[[Any, Any], Any]


def normalize_api_request_path(path: str | None) -> str | None:
    if not path:
        return None
    normalized = path.strip("/")
    return normalized or None


def resolve_api_handler_path(api_input: UnsApiProxy, path: str | None) -> str | None:
    normalized = normalize_api_request_path(path)
    if not normalized:
        return None
    api_prefix = normalize_api_request_path(getattr(api_input, "api_base_prefix", None))
    if api_prefix and normalized.startswith(f"{api_prefix}/"):
        return normalized[len(api_prefix) + 1 :]
    return normalized


async def register_api_catalog(
    api_input: UnsApiProxy,
    input_value: Mapping[str, Any],
) -> dict[str, Any]:
    service_apis = input_value.get("serviceApis") or input_value.get("service_apis") or {}
    data_offer_sources = input_value.get("dataOfferSources") or input_value.get("data_offer_sources") or {}
    context = input_value.get("context")
    data_catalog_offers = input_value.get("dataCatalogOffers") or input_value.get("data_catalog_offers")
    options = input_value.get("options") or {}

    service_api_routes = list(build_service_api_interactions(api_input.get_process_name(), service_apis).values())
    data_offer_routes = list(build_api_interactions_from_data_offer_sources(data_offer_sources).values())
    catalog_offers = (
        list(data_catalog_offers)
        if data_catalog_offers is not None
        else build_data_catalog_offers_from_sources(data_offer_sources)
    )
    all_routes = [*service_api_routes, *data_offer_routes]

    await register_api_interactions(api_input, all_routes)
    for offer in catalog_offers:
        if hasattr(offer, "to_dict"):
            api_input.register_data_offer(offer.to_dict())
        else:
            api_input.register_data_offer(offer)
    register_api_events(api_input, all_routes, context, options)

    return {
        "serviceApiRoutes": service_api_routes,
        "dataOfferRoutes": data_offer_routes,
        "dataCatalogOffers": catalog_offers,
    }


async def register_api_interactions(
    api_input: UnsApiProxy,
    routes: list[ApiInteractionDefinition],
) -> None:
    for route in routes:
        if route.method == "GET":
            await api_input.get(route.topic, route.asset, route.object_type, route.object_id, route.attribute, route.options)
        elif route.method == "POST":
            await api_input.post(route.topic, route.asset, route.object_type, route.object_id, route.attribute, route.options)
        elif route.method == "PUT":
            await api_input.put(route.topic, route.asset, route.object_type, route.object_id, route.attribute, route.options)
        elif route.method == "PATCH":
            await api_input.patch(route.topic, route.asset, route.object_type, route.object_id, route.attribute, route.options)
        elif route.method == "DELETE":
            await api_input.delete(route.topic, route.asset, route.object_type, route.object_id, route.attribute, route.options)
        else:
            raise ValueError(f"Unsupported API method: {route.method}")


def register_api_events(
    api_input: UnsApiProxy,
    routes: list[ApiInteractionDefinition],
    context: Any,
    options: Mapping[str, Any] | None = None,
) -> None:
    resolved_options = dict(options or {})
    handlers_by_method = _build_route_handler_index(routes)
    _bind_method_event(api_input, "GET", handlers_by_method["GET"], context, resolved_options)
    _bind_method_event(api_input, "POST", handlers_by_method["POST"], context, resolved_options)
    _bind_method_event(api_input, "PUT", handlers_by_method["PUT"], context, resolved_options)
    _bind_method_event(api_input, "PATCH", handlers_by_method["PATCH"], context, resolved_options)
    _bind_method_event(api_input, "DELETE", handlers_by_method["DELETE"], context, resolved_options)


def _build_route_handler_index(routes: list[ApiInteractionDefinition]) -> dict[str, dict[str, ApiHandler]]:
    handlers: dict[str, dict[str, ApiHandler]] = {
        "GET": {},
        "POST": {},
        "PUT": {},
        "PATCH": {},
        "DELETE": {},
    }
    for route in routes:
        handlers[route.method][build_api_interaction_topic_path(route)] = route.handler
    return handlers


def _bind_method_event(
    api_input: UnsApiProxy,
    method: ApiInteractionMethod,
    handlers: dict[str, ApiHandler],
    context: Any,
    options: Mapping[str, Any],
) -> None:
    event_name = {
        "GET": "apiGetEvent",
        "POST": "apiPostEvent",
        "PUT": "apiPutEvent",
        "PATCH": "apiPatchEvent",
        "DELETE": "apiDeleteEvent",
    }[method]

    async def on_event(event: Any) -> None:
        req_path = resolve_api_handler_path(api_input, getattr(event.req, "url").path)
        handler = handlers.get(req_path or "")
        if handler is None:
            event.res.status(404).text(options.get("notFoundMessage") or "API handler not found")
            return
        try:
            await handler(event, context)
        except Exception as error:
            on_error = options.get("onError")
            if callable(on_error):
                on_error({"method": method, "reqPath": req_path, "error": error})
            event.res.status(500).text("Server error")

    api_input.event.on(event_name, on_event)
