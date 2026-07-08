from __future__ import annotations

from fastapi import Response

from uns_kit.api.data_catalog import (
    define_data_catalog_field,
    define_data_catalog_offer_source,
    define_data_catalog_query_param,
    define_data_catalog_schema,
    project_rows_for_data_catalog_schema,
    write_schema_rows_to_parquet,
)

SYNTHETIC_EXPORT_ROWS = [
    {"orderId": "ORD-1001", "coilId": "COIL-10024", "length": 1280, "lineSpeed": 84.5, "ovenZone1Temp": 712},
    {"orderId": "ORD-1002", "coilId": "COIL-10025", "length": 1325, "lineSpeed": 86.2, "ovenZone1Temp": 718},
    {"orderId": "ORD-1003", "coilId": "COIL-10026", "length": 1190, "lineSpeed": 82.1, "ovenZone1Temp": 705},
    {"orderId": "ORD-1004", "coilId": "COIL-10027", "length": 1190, "lineSpeed": 82.1, "ovenZone1Temp": 705},
    {"orderId": "ORD-1005", "coilId": "COIL-10028", "length": 2152, "lineSpeed": 82.1, "ovenZone1Temp": 602},
    {"orderId": "ORD-1006", "coilId": "COIL-10029", "length": 1235, "lineSpeed": 82.1, "ovenZone1Temp": 755},
]

demo_export_schema = define_data_catalog_schema(
    {
        "id": "demo-export-columns",
        "title": "Sample Coil Export Columns",
        "contentType": "application/octet-stream",
        "description": "Columns contained in the synthetic Parquet export dataset.",
        "fields": [
            define_data_catalog_field("orderId", "string", "Order identifier", example="ORD-1001"),
            define_data_catalog_field("coilId", "string", "Coil identifier", example="COIL-10024"),
            define_data_catalog_field("length", "number", "Measured strip length", example=1280),
            define_data_catalog_field("lineSpeed", "number", "Line speed", example=84.5),
            define_data_catalog_field("ovenZone1Temp", "number", "Oven zone 1 temperature", example=712),
        ],
    }
)


def _build_demo_export_bytes(order_id: str | None) -> bytes | None:
    rows = [row for row in SYNTHETIC_EXPORT_ROWS if not order_id or row["orderId"] == order_id]
    if not rows:
        return None
    projected_rows = project_rows_for_data_catalog_schema(rows, demo_export_schema)
    return write_schema_rows_to_parquet(rows=projected_rows, schema=demo_export_schema)


async def demo_export_handler(event, _context) -> None:
    order_id = str(event.req.query_params.get("orderId", "")).strip() or None
    payload = _build_demo_export_bytes(order_id)
    if payload is None:
        event.res.response(Response(status_code=204))
        return
    event.res.response(
        Response(
            content=payload,
            media_type="application/octet-stream",
            headers={"Content-Disposition": 'attachment; filename="demo-export.parquet"'},
        )
    )


demo_export_offer = define_data_catalog_offer_source(
    {
        "offer_id": "demo-export",
        "topic": "enterprise/site/area/line/",
        "asset": "annealing-line",
        "object_type": "process-segment",
        "object_id": "coil",
        "attribute": "export",
        "display_name": "Demo Coil Export",
        "description": "Minimal synthetic Parquet data offer example.",
        "tags": ["demo", "parquet"],
        "method": "GET",
        "query_params": [
            define_data_catalog_query_param("orderId", "Optional order filter", example="ORD-1001"),
        ],
        "schema": demo_export_schema,
        "response": {
            "status_code": "200",
            "description": "Parquet file download",
            "content_type": "application/octet-stream",
            "schemas": [demo_export_schema],
        },
        "handler": demo_export_handler,
    }
)
