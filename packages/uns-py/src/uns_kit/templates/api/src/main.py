import asyncio
from pathlib import Path

from uns_kit.api.event_routing import register_api_catalog
from uns_kit.core.config_file import ConfigFile
from uns_kit.core.logger import configure_logger, get_logger
from uns_kit.core.proxy_process import UnsProxyProcess

from api_routes import service_apis


async def run() -> None:
    cfg = ConfigFile.load_config(Path("config.json"))
    infra = cfg.get("infra") or {}
    uns = cfg.get("uns") or {}
    logging_cfg = cfg.get("logging") or {}

    configure_logger(
        settings={
            "level": logging_cfg.get("level") or "INFO",
            "console": True,
            "service": uns.get("processName") or "python-service-api",
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
        {"processName": uns.get("processName") or "python-service-api"},
    )
    await process.start()
    api = await process.create_api_proxy("api")
    logger = get_logger(__name__)
    await register_api_catalog(
        api,
        {
            "serviceApis": service_apis,
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
    print(f"Service GET:  {base_url}/api/system/service/runtime/{process.get_process_name()}/status")
    print(f"Service POST: {base_url}/api/system/service/runtime/{process.get_process_name()}/command")
    print(f"Swagger:      {base_url}{api.swagger_json_path}")

    try:
        await asyncio.Event().wait()
    finally:
        await process.stop()


if __name__ == "__main__":
    asyncio.run(run())
