from __future__ import annotations

from fastapi import Response

from uns_kit.api import (
    define_data_catalog_field,
    define_data_catalog_offer_source,
    define_data_catalog_query_param,
    define_data_catalog_schema,
    project_rows_for_data_catalog_schema,
)

SYNTHETIC_COILS = [
    {"orderId": "ORD-1001", "coilId": "COIL-10024", "grade": "M250-35A", "status": "planned"},
    {"orderId": "ORD-1002", "coilId": "COIL-10025", "grade": "M250-35A", "status": "planned"},
    {"orderId": "ORD-1003", "coilId": "COIL-10026", "grade": "M250-35A", "status": "planned"},
    {"orderId": "ORD-1004", "coilId": "COIL-10027", "grade": "M270-35A", "status": "running"},
    {"orderId": "ORD-1005", "coilId": "COIL-10028", "grade": "M330-35A", "status": "done"},
    {"orderId": "ORD-1006", "coilId": "COIL-10029", "grade": "M330-35A", "status": "done"},
]

demo_coils_schema = define_data_catalog_schema(
    {
        "id": "demo-coils-response",
        "title": "Sample Coil Orders",
        "contentType": "application/json",
        "fields": [
            define_data_catalog_field("orderId", "string", "Order identifier", required=True, example="ORD-1001"),
            define_data_catalog_field("coilId", "string", "Coil identifier", required=True, example="COIL-10024"),
            define_data_catalog_field("grade", "string", "Steel grade", example="M250-35A"),
            define_data_catalog_field("status", "string", "Order status", example="planned"),
        ],
    }
)


async def demo_coils_handler(event, _context) -> None:
    status = str(event.req.query_params.get("status", "")).strip().lower()
    rows = [row for row in SYNTHETIC_COILS if not status or row["status"].lower() == status]
    if not rows:
        event.res.response(Response(status_code=204))
        return
    event.res.json(project_rows_for_data_catalog_schema(rows, demo_coils_schema))


demo_coils_offer = define_data_catalog_offer_source(
    {
        "offer_id": "demo-coils",
        "topic": "enterprise/site/area/line/",
        "asset": "annealing-line",
        "object_type": "material",
        "object_id": "coil",
        "attribute": "orders",
        "display_name": "Demo Coil Orders",
        "description": "Minimal synthetic JSON data offer example.",
        "tags": ["demo", "json"],
        "method": "GET",
        "query_params": [
            define_data_catalog_query_param("status", "Optional status filter", example="running"),
        ],
        "schema": demo_coils_schema,
        "response": {
            "status_code": "200",
            "description": "Synthetic coil order list",
            "content_type": "application/json",
            "schemas": [demo_coils_schema],
        },
        "handler": demo_coils_handler,
    }
)
