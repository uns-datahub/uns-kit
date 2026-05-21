import asyncio
from pathlib import Path

from uns_kit.api import register_api_catalog
from uns_kit.core import ConfigFile, UnsProxyProcess, configure_logger
from uns_kit.core import get_logger

from api_routes import data_offer_sources, service_apis


async def run() -> None:
    cfg = ConfigFile.load_config(Path("config.json"))
    infra = cfg.get("infra") or {}
    uns = cfg.get("uns") or {}
    logging_cfg = cfg.get("logging") or {}

    configure_logger(
        settings={
            "level": logging_cfg.get("level") or "INFO",
            "console": True,
            "service": uns.get("processName") or "python-api",
            **(
                {
                    "graylog": {
                        "host": logging_cfg["host"],
                        "port": logging_cfg.get("port", 12201),
                        "enabled": True,
                    }
                }
                if logging_cfg.get("host")
                else {}
            ),
        }
    )

    process = UnsProxyProcess(
        infra.get("host") or "localhost",
        {"processName": uns.get("processName") or "python-api"},
    )
    await process.start()
    api = await process.create_api_proxy("api")
    logger = get_logger(__name__)
    await register_api_catalog(
        api,
        {
            "serviceApis": service_apis,
            "dataOfferSources": data_offer_sources,
            "context": None,
            "options": {
                "onError": lambda input_value: logger.error(
                    "Handler error [%s %s]: %s",
                    input_value["method"],
                    input_value.get("reqPath") or "",
                    input_value["error"],
                )
            },
        },
    )

    base_url = f"http://127.0.0.1:{api._port}"
    print(f"Service GET:  {base_url}/api/factory/demo/app/service/microservice/runtime/status")
    print(f"Service POST: {base_url}/api/factory/demo/app/service/microservice/runtime/command")
    print(f"JSON offer:   {base_url}/api/enterprise/site/area/line/annealing-line/material/coil/orders?status=running")
    print(f"Parquet:      {base_url}/api/enterprise/site/area/line/annealing-line/process-segment/coil/export?orderId=ORD-1001")
    print(f"Swagger:      {base_url}{api.swagger_json_path}")

    try:
        await asyncio.Event().wait()
    finally:
        await process.stop()


if __name__ == "__main__":
    asyncio.run(run())
