import asyncio
from pathlib import Path

from uns_kit import ConfigFile, UnsProxyProcess
from uns_kit.logger import configure_logger


configure_logger(settings={"level": "INFO", "console": True})


async def run() -> None:
    config = ConfigFile.load_config(Path("config.json"))
    infra = config.get("infra") or {}
    uns = config.get("uns") or {}

    api_options = (
        {
            "jwks": {
                "wellKnownJwksUrl": uns["jwksWellKnownUrl"],
                **({"activeKidUrl": uns["kidWellKnownUrl"]} if uns.get("kidWellKnownUrl") else {}),
            }
        }
        if uns.get("jwksWellKnownUrl")
        else {"jwtSecret": "CHANGEME"}
    )

    process = UnsProxyProcess(
        infra.get("host") or "localhost",
        {"processName": uns.get("processName") or "uns-api"},
    )
    await process.start()
    api = await process.create_api_proxy("templateUnsApiInput", api_options)

    await api.get(
        "enterprise/site/area/line/",
        "line-3-furnace",
        "energy-resource",
        "main-bus",
        "current",
        {
            "tags": ["Energy"],
            "apiDescription": "Current reading for line-3-furnace main-bus",
            "queryParams": [
                {"name": "from", "type": "string", "required": False, "description": "Start of time range (ISO 8601)", "chatCanonical": "from"},
                {"name": "to", "type": "string", "required": False, "description": "End of time range (ISO 8601)", "chatCanonical": "to"},
                {"name": "limit", "type": "number", "required": False, "description": "Maximum number of records", "chatCanonical": "limit", "defaultValue": 100},
            ],
            "chatDefaults": {"limit": 100},
        },
    )

    await api.post(
        "enterprise/site/area/line/",
        "line-3-furnace",
        "energy-resource",
        "main-bus",
        "setpoint",
        {
            "tags": ["Energy"],
            "apiDescription": "Write a new setpoint for line-3-furnace main-bus",
            "requestBody": {
                "description": "Setpoint payload",
                "required": True,
                "schema": {
                    "type": "object",
                    "required": ["value"],
                    "properties": {
                        "value": {"type": "number", "description": "Target setpoint value"},
                        "unit": {"type": "string", "description": "Unit of measurement, e.g. A"},
                    },
                },
            },
        },
    )

    async def handle_get(event):
        event.res.json({"status": "ok", "data": [], "query": dict(event.req.query_params)})

    async def handle_post(event):
        body = await event.req.json()
        event.res.json({"status": "ok", "received": body})

    api.event.on("apiGetEvent", handle_get)
    api.event.on("apiPostEvent", handle_post)

    try:
        await asyncio.Event().wait()
    finally:
        await process.stop()


if __name__ == "__main__":
    asyncio.run(run())
