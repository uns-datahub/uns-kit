from __future__ import annotations

from uns_kit.api import (
    define_data_catalog_field,
    define_data_catalog_schema,
    define_service_api,
)

from data_offers.demo_coils import demo_coils_offer
from data_offers.demo_export import demo_export_offer


async def status_handler(event, _context) -> None:
    event.res.json({"status": "ok", "service": "python-service"})


command_request_schema = define_data_catalog_schema(
    {
        "id": "service-command-request",
        "title": "Service Command Request",
        "contentType": "application/json",
        "fields": [
            define_data_catalog_field(
                "command",
                "string",
                "Command name",
                required=True,
                example="refresh-cache",
            ),
            define_data_catalog_field(
                "target",
                "string",
                "Optional target",
                example="orders",
            ),
        ],
    }
)


async def command_handler(event, _context) -> None:
    body = await event.req.json()
    command = body.get("command")
    if not command:
        event.res.status(400).json({"error": "Missing command"})
        return
    event.res.json(
        {
            "status": "accepted",
            "received": {
                "command": command,
                **({"target": body.get("target")} if body.get("target") else {}),
            },
        }
    )


service_apis = {
    "status": define_service_api(
        {
            "attribute": "status",
            "method": "GET",
            "description": "Service status endpoint",
            "tags": ["service"],
            "handler": status_handler,
        }
    ),
    "command": define_service_api(
        {
            "attribute": "command",
            "method": "POST",
            "description": "Service command endpoint",
            "tags": ["service"],
            "request_body": {
                "required": True,
                "description": "Command payload",
                "content_type": "application/json",
                "schemas": [command_request_schema],
            },
            "handler": command_handler,
        }
    ),
}


data_offer_sources = {
    "demoCoils": demo_coils_offer,
    "demoExport": demo_export_offer,
}
