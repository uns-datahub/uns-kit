from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal, Mapping, Optional

from ..core.uns_path import build_uns_route_path

ApiInteractionMethod = Literal["GET", "POST", "PUT", "PATCH", "DELETE"]


@dataclass(frozen=True)
class DataCatalogParameterRegistration:
    name: str
    location: Literal["path", "query", "header", "cookie"]
    required: bool = False
    description: Optional[str] = None
    type: Optional[str] = None
    format: Optional[str] = None
    nullable: bool = False
    example: Any = None
    enum_values: list[str] = field(default_factory=list)
    schema: Any = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "in": self.location,
            "required": self.required,
            "description": self.description,
            "type": self.type,
            "format": self.format,
            "nullable": self.nullable,
            "example": self.example,
            "enumValues": self.enum_values,
            "schema": self.schema,
        }


@dataclass(frozen=True)
class DataCatalogSchemaFieldRegistration:
    name: str
    path: Optional[str] = None
    source_key: Optional[str] = None
    type: Optional[str] = None
    format: Optional[str] = None
    nullable: bool = False
    required: bool = False
    description: Optional[str] = None
    enum_values: list[str] = field(default_factory=list)
    example: Any = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "path": self.path,
            "sourceKey": self.source_key,
            "type": self.type,
            "format": self.format,
            "nullable": self.nullable,
            "required": self.required,
            "description": self.description,
            "enumValues": self.enum_values,
            "example": self.example,
        }


@dataclass(frozen=True)
class DataCatalogSchemaRegistration:
    id: str
    title: str
    content_type: str
    fields: list[DataCatalogSchemaFieldRegistration]
    kind: Optional[str] = None
    source: Optional[str] = None
    root_type: Optional[str] = None
    field_path_prefix: Optional[str] = None
    nullable: bool = False
    description: Optional[str] = None
    example_payloads: list[Any] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "contentType": self.content_type,
            "fields": [field.to_dict() for field in self.fields],
            "kind": self.kind,
            "source": self.source,
            "rootType": self.root_type,
            "fieldPathPrefix": self.field_path_prefix,
            "nullable": self.nullable,
            "description": self.description,
            "examplePayloads": self.example_payloads,
        }


@dataclass(frozen=True)
class DataCatalogRequestBodyRegistration:
    required: bool = False
    description: Optional[str] = None
    content_type: Optional[str] = None
    schemas: list[DataCatalogSchemaRegistration] = field(default_factory=list)
    schema_ids: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "required": self.required,
            "description": self.description,
            "contentType": self.content_type,
            "schemas": [schema.to_dict() for schema in self.schemas],
            "schemaIds": self.schema_ids,
        }


@dataclass(frozen=True)
class DataCatalogResponseRegistration:
    status_code: str
    description: Optional[str] = None
    content_type: Optional[str] = None
    schemas: list[DataCatalogSchemaRegistration] = field(default_factory=list)
    schema_ids: list[str] = field(default_factory=list)
    example_payloads: list[Any] = field(default_factory=list)
    headers: list[DataCatalogParameterRegistration] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "statusCode": self.status_code,
            "description": self.description,
            "contentType": self.content_type,
            "schemas": [schema.to_dict() for schema in self.schemas],
            "schemaIds": self.schema_ids,
            "examplePayloads": self.example_payloads,
            "headers": [header.to_dict() for header in self.headers],
        }


@dataclass(frozen=True)
class DataCatalogOperationRegistration:
    method: ApiInteractionMethod | Literal["HEAD", "OPTIONS"]
    path: str
    id: Optional[str] = None
    summary: Optional[str] = None
    description: Optional[str] = None
    tags: list[str] = field(default_factory=list)
    deprecated: bool = False
    parameters: list[DataCatalogParameterRegistration] = field(default_factory=list)
    headers: list[DataCatalogParameterRegistration] = field(default_factory=list)
    request_body: Optional[DataCatalogRequestBodyRegistration] = None
    responses: list[DataCatalogResponseRegistration] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "method": self.method,
            "path": self.path,
            "summary": self.summary,
            "description": self.description,
            "tags": self.tags,
            "deprecated": self.deprecated,
            "parameters": [parameter.to_dict() for parameter in self.parameters],
            "headers": [header.to_dict() for header in self.headers],
            "requestBody": self.request_body.to_dict() if self.request_body else None,
            "responses": [response.to_dict() for response in self.responses],
        }


@dataclass(frozen=True)
class DataCatalogOfferRegistration:
    offer_id: str
    display_name: str
    operations: list[DataCatalogOperationRegistration]
    description: Optional[str] = None
    owner: Optional[str] = None
    status: Optional[str] = None
    tags: list[str] = field(default_factory=list)
    categories: list[str] = field(default_factory=list)
    microservice_name: Optional[str] = None
    version: Optional[str] = None
    base_paths: list[str] = field(default_factory=list)
    schemas: list[DataCatalogSchemaRegistration] = field(default_factory=list)
    swagger_path: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "offerId": self.offer_id,
            "displayName": self.display_name,
            "description": self.description,
            "owner": self.owner,
            "status": self.status,
            "tags": self.tags,
            "categories": self.categories,
            "microserviceName": self.microservice_name,
            "version": self.version,
            "basePaths": self.base_paths,
            "operations": [operation.to_dict() for operation in self.operations],
            "schemas": [schema.to_dict() for schema in self.schemas],
            "swaggerPath": self.swagger_path,
            "metadata": self.metadata,
        }


@dataclass(frozen=True)
class DataCatalogOfferSourceRegistration:
    offer_id: str
    topic: str
    asset: str
    object_type: str
    object_id: str
    attribute: str
    display_name: str
    description: str
    schema: DataCatalogSchemaRegistration
    handler: Any
    owner: Optional[str] = None
    status: Optional[str] = None
    tags: list[str] = field(default_factory=list)
    categories: list[str] = field(default_factory=list)
    method: ApiInteractionMethod = "GET"
    query_params: list[DataCatalogParameterRegistration] = field(default_factory=list)
    headers: list[DataCatalogParameterRegistration] = field(default_factory=list)
    request_body: Optional[DataCatalogRequestBodyRegistration] = None
    response: Optional[DataCatalogResponseRegistration] = None
    api_description: Optional[str] = None


@dataclass(frozen=True)
class ServiceApiRegistration:
    attribute: str
    description: str
    handler: Any
    method: ApiInteractionMethod = "GET"
    publish_in_uns_tree: bool = False
    tags: list[str] = field(default_factory=list)
    query_params: list[DataCatalogParameterRegistration] = field(default_factory=list)
    request_body: Optional[DataCatalogRequestBodyRegistration] = None
    response: Optional[DataCatalogResponseRegistration] = None
    schema: Optional[DataCatalogSchemaRegistration] = None
    topic: Optional[str] = None
    asset: Optional[str] = None
    object_type: Optional[str] = None
    object_id: Optional[str] = None


@dataclass(frozen=True)
class ApiInteractionDefinition:
    id: str
    topic: str
    asset: str
    object_type: str
    object_id: str
    attribute: str
    method: ApiInteractionMethod
    options: Mapping[str, Any]
    handler: Any
    route_only: bool = False
    registry_topic: Literal["api-endpoints", "service-endpoints", "data-offer-endpoints"] = "api-endpoints"


def define_api_interaction(input_value: ApiInteractionDefinition) -> ApiInteractionDefinition:
    return input_value


def define_service_api(input_value: ServiceApiRegistration | Mapping[str, Any]) -> ServiceApiRegistration:
    if isinstance(input_value, ServiceApiRegistration):
        return input_value
    return ServiceApiRegistration(
        attribute=str(input_value["attribute"]),
        description=str(input_value["description"]),
        handler=input_value["handler"],
        method=str(input_value.get("method") or "GET").upper(),  # type: ignore[arg-type]
        publish_in_uns_tree=bool(input_value.get("publish_in_uns_tree") or input_value.get("publishInUnsTree", False)),
        tags=list(input_value.get("tags") or []),
        query_params=[_coerce_parameter(item) for item in input_value.get("query_params") or input_value.get("queryParams") or []],
        request_body=_coerce_request_body(input_value.get("request_body") or input_value.get("requestBody")),
        response=_coerce_response(input_value.get("response")),
        schema=_coerce_schema(input_value.get("schema")),
        topic=input_value.get("topic"),
        asset=input_value.get("asset"),
        object_type=input_value.get("object_type") or input_value.get("objectType"),
        object_id=input_value.get("object_id") or input_value.get("objectId"),
    )


def define_data_catalog_offer_source(
    input_value: DataCatalogOfferSourceRegistration | Mapping[str, Any],
) -> DataCatalogOfferSourceRegistration:
    if isinstance(input_value, DataCatalogOfferSourceRegistration):
        return input_value
    return DataCatalogOfferSourceRegistration(
        offer_id=str(input_value["offer_id"] if "offer_id" in input_value else input_value["offerId"]),
        topic=str(input_value["topic"]),
        asset=str(input_value["asset"]),
        object_type=str(input_value.get("object_type") or input_value.get("objectType")),
        object_id=str(input_value.get("object_id") or input_value.get("objectId")),
        attribute=str(input_value["attribute"]),
        display_name=str(input_value.get("display_name") or input_value.get("displayName")),
        description=str(input_value["description"]),
        schema=_coerce_schema(input_value.get("schema"), required=True),
        handler=input_value["handler"],
        owner=input_value.get("owner"),
        status=input_value.get("status"),
        tags=list(input_value.get("tags") or []),
        categories=list(input_value.get("categories") or []),
        method=str(input_value.get("method") or "GET").upper(),  # type: ignore[arg-type]
        query_params=[_coerce_parameter(item) for item in input_value.get("query_params") or input_value.get("queryParams") or []],
        headers=[_coerce_parameter(item) for item in input_value.get("headers") or []],
        request_body=_coerce_request_body(input_value.get("request_body") or input_value.get("requestBody")),
        response=_coerce_response(input_value.get("response")),
        api_description=input_value.get("api_description") or input_value.get("apiDescription"),
    )


def build_api_interaction_path(
    route: ApiInteractionDefinition | Mapping[str, Any],
    api_base_prefix: str = "/api",
) -> str:
    route_path = build_uns_route_path(
        str(route["topic"] if isinstance(route, Mapping) else route.topic),
        str(route["asset"] if isinstance(route, Mapping) else route.asset),
        str(route["object_type"] if isinstance(route, Mapping) else route.object_type),
        str(route["object_id"] if isinstance(route, Mapping) else route.object_id),
        str(route["attribute"] if isinstance(route, Mapping) else route.attribute),
    )
    return f"{api_base_prefix}{route_path}".replace("//", "/")


def build_api_interaction_topic_path(route: ApiInteractionDefinition | Mapping[str, Any]) -> str:
    return build_api_interaction_path(route, api_base_prefix="").lstrip("/")


def define_data_catalog_query_param(
    name: str,
    description: str,
    *,
    required: bool = False,
    type: str = "string",
    format: Optional[str] = None,
    example: Any = None,
) -> DataCatalogParameterRegistration:
    return DataCatalogParameterRegistration(
        name=name,
        location="query",
        type=type,
        required=required,
        description=description,
        format=format,
        example=example,
    )


def define_data_catalog_field(
    name: str,
    type: str,
    description: str,
    *,
    path: Optional[str] = None,
    source_key: Optional[str] = None,
    required: bool = False,
    format: Optional[str] = None,
    nullable: bool = False,
    example: Any = None,
    enum_values: Optional[list[str]] = None,
) -> DataCatalogSchemaFieldRegistration:
    return DataCatalogSchemaFieldRegistration(
        name=name,
        path=path or name,
        source_key=source_key,
        type=type,
        format=format,
        nullable=nullable,
        required=required,
        description=description,
        example=example,
        enum_values=enum_values or [],
    )


def define_data_catalog_schema(input_value: Mapping[str, Any]) -> DataCatalogSchemaRegistration:
    fields = [
        field if isinstance(field, DataCatalogSchemaFieldRegistration) else DataCatalogSchemaFieldRegistration(**field)
        for field in input_value.get("fields", [])
    ]
    return DataCatalogSchemaRegistration(
        id=str(input_value["id"]),
        title=str(input_value["title"]),
        content_type=str(input_value.get("contentType") or input_value.get("content_type") or "application/json"),
        kind=input_value.get("kind"),
        source=input_value.get("source"),
        root_type=input_value.get("rootType") or input_value.get("root_type"),
        field_path_prefix=input_value.get("fieldPathPrefix") or input_value.get("field_path_prefix"),
        nullable=bool(input_value.get("nullable", False)),
        description=input_value.get("description"),
        fields=fields,
        example_payloads=list(input_value.get("examplePayloads") or input_value.get("example_payloads") or []),
    )


def _coerce_parameter(value: DataCatalogParameterRegistration | Mapping[str, Any]) -> DataCatalogParameterRegistration:
    if isinstance(value, DataCatalogParameterRegistration):
        return value
    return DataCatalogParameterRegistration(
        name=str(value["name"]),
        location=value.get("location") or value.get("in") or "query",
        required=bool(value.get("required", False)),
        description=value.get("description"),
        type=value.get("type"),
        format=value.get("format"),
        nullable=bool(value.get("nullable", False)),
        example=value.get("example"),
        enum_values=list(value.get("enum_values") or value.get("enumValues") or []),
        schema=value.get("schema"),
    )


def _coerce_schema(
    value: DataCatalogSchemaRegistration | Mapping[str, Any] | None,
    *,
    required: bool = False,
) -> DataCatalogSchemaRegistration | None:
    if value is None:
        if required:
            raise ValueError("A schema definition is required.")
        return None
    if isinstance(value, DataCatalogSchemaRegistration):
        return value
    return define_data_catalog_schema(value)


def _coerce_request_body(
    value: DataCatalogRequestBodyRegistration | Mapping[str, Any] | None,
) -> DataCatalogRequestBodyRegistration | None:
    if value is None:
        return None
    if isinstance(value, DataCatalogRequestBodyRegistration):
        return value
    schemas = [_coerce_schema(item, required=True) for item in value.get("schemas") or []]
    return DataCatalogRequestBodyRegistration(
        required=bool(value.get("required", False)),
        description=value.get("description"),
        content_type=value.get("content_type") or value.get("contentType"),
        schemas=[schema for schema in schemas if schema is not None],
        schema_ids=list(value.get("schema_ids") or value.get("schemaIds") or []),
    )


def _coerce_response(
    value: DataCatalogResponseRegistration | Mapping[str, Any] | None,
) -> DataCatalogResponseRegistration | None:
    if value is None:
        return None
    if isinstance(value, DataCatalogResponseRegistration):
        return value
    schemas = [_coerce_schema(item, required=True) for item in value.get("schemas") or []]
    return DataCatalogResponseRegistration(
        status_code=str(value.get("status_code") or value.get("statusCode") or "200"),
        description=value.get("description"),
        content_type=value.get("content_type") or value.get("contentType"),
        schemas=[schema for schema in schemas if schema is not None],
        schema_ids=list(value.get("schema_ids") or value.get("schemaIds") or []),
        example_payloads=list(value.get("example_payloads") or value.get("examplePayloads") or []),
        headers=[_coerce_parameter(item) for item in value.get("headers") or []],
    )


def build_service_api_interactions(
    process_name: str,
    definitions: Mapping[str, ServiceApiRegistration],
) -> dict[str, ApiInteractionDefinition]:
    interactions: dict[str, ApiInteractionDefinition] = {}
    for key, definition in definitions.items():
        interactions[str(key)] = define_api_interaction(
            ApiInteractionDefinition(
                id=str(key),
                topic=definition.topic or "system",
                asset=definition.asset or "service",
                object_type=definition.object_type or "runtime",
                object_id=definition.object_id or process_name,
                attribute=definition.attribute,
                method=definition.method or "GET",
                route_only=not definition.publish_in_uns_tree,
                registry_topic="service-endpoints",
                options=_build_api_interaction_options(
                    definition.method or "GET",
                    definition.description,
                    definition.tags,
                    definition.query_params,
                    definition.request_body,
                    not definition.publish_in_uns_tree,
                    "service-endpoints",
                    _build_service_api_payload(str(key), definition),
                ),
                handler=definition.handler,
            )
        )
    return interactions


def build_api_interactions_from_data_offer_sources(
    sources: Mapping[str, DataCatalogOfferSourceRegistration],
) -> dict[str, ApiInteractionDefinition]:
    interactions: dict[str, ApiInteractionDefinition] = {}
    for key, source in sources.items():
        interactions[str(key)] = define_api_interaction(
            ApiInteractionDefinition(
                id=source.offer_id,
                topic=source.topic,
                asset=source.asset,
                object_type=source.object_type,
                object_id=source.object_id,
                attribute=source.attribute,
                method=source.method or "GET",
                route_only=True,
                registry_topic="data-offer-endpoints",
                options=_build_api_interaction_options(
                    source.method or "GET",
                    source.api_description or source.description,
                    source.tags,
                    source.query_params,
                    source.request_body,
                    True,
                    "data-offer-endpoints",
                ),
                handler=source.handler,
            )
        )
    return interactions


def build_data_catalog_offers_from_sources(
    sources: Mapping[str, DataCatalogOfferSourceRegistration],
) -> list[DataCatalogOfferRegistration]:
    offers: list[DataCatalogOfferRegistration] = []
    for source in sources.values():
        offers.append(
            DataCatalogOfferRegistration(
                offer_id=source.offer_id,
                display_name=source.display_name,
                description=source.description,
                owner=source.owner,
                status=source.status or "available",
                tags=source.tags,
                categories=source.categories,
                schemas=[source.schema],
                operations=[
                    DataCatalogOperationRegistration(
                        id=f"{source.offer_id}-{(source.method or 'GET').lower()}",
                        method=source.method or "GET",
                        path=build_api_interaction_path(
                            {
                                "topic": source.topic,
                                "asset": source.asset,
                                "object_type": source.object_type,
                                "object_id": source.object_id,
                                "attribute": source.attribute,
                            }
                        ),
                        summary=source.display_name,
                        description=source.description,
                        tags=source.tags,
                        parameters=source.query_params,
                        headers=source.headers,
                        request_body=source.request_body,
                        responses=[
                            source.response
                            or DataCatalogResponseRegistration(
                                status_code="200",
                                description=source.description,
                                content_type=source.schema.content_type,
                                schemas=[source.schema],
                            )
                        ],
                    )
                ],
            )
        )
    return offers


def _build_api_interaction_options(
    method: ApiInteractionMethod,
    description: str,
    tags: Optional[list[str]] = None,
    query_params: Optional[list[DataCatalogParameterRegistration]] = None,
    request_body: Optional[DataCatalogRequestBodyRegistration] = None,
    route_only: bool = True,
    registry_topic: Literal["api-endpoints", "service-endpoints", "data-offer-endpoints"] = "api-endpoints",
    service_api: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    base: dict[str, Any] = {
        "apiDescription": description,
        "tags": list(tags or []),
        "routeOnly": route_only,
        "registryTopic": registry_topic,
    }
    if method == "GET":
        base["queryParams"] = [
            parameter.to_dict() if hasattr(parameter, "to_dict") else parameter
            for parameter in (query_params or [])
        ]
    else:
        if request_body is not None:
            base["requestBody"] = request_body.to_dict() if hasattr(request_body, "to_dict") else request_body
    if service_api:
        base["serviceApi"] = service_api
    return base


def _build_service_api_payload(
    id: str,
    definition: ServiceApiRegistration,
) -> dict[str, Any]:
    schemas = [definition.schema.to_dict()] if definition.schema is not None else []
    response = definition.response or DataCatalogResponseRegistration(
        status_code="200",
        description=definition.description,
        content_type=definition.schema.content_type if definition.schema is not None else None,
        schemas=[definition.schema] if definition.schema is not None else [],
    )

    return {
        "id": id,
        "summary": definition.description,
        "description": definition.description,
        "tags": list(definition.tags or []),
        "parameters": [parameter.to_dict() for parameter in definition.query_params],
        "headers": [],
        "requestBody": definition.request_body.to_dict() if definition.request_body is not None else None,
        "responses": [response.to_dict()],
        "schemas": schemas,
    }
