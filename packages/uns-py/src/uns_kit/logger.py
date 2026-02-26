from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime, timezone
from logging.handlers import TimedRotatingFileHandler
from typing import Any, TypedDict

from .topic_builder import resolve_runtime_package_metadata
from .version import __package_name__


class GraylogSettings(TypedDict, total=False):
    host: str
    port: int
    enabled: bool


class LoggerSettings(TypedDict, total=False):
    level: str | int
    service: str
    console: bool
    file_path: str | None
    graylog: GraylogSettings

_DEFAULT_LEVEL = os.getenv("UNS_LOG_LEVEL", "INFO").upper()
_DEFAULT_GRAYLOG_HOST = os.getenv("UNS_GRAYLOG_HOST")
_DEFAULT_GRAYLOG_PORT = int(os.getenv("UNS_GRAYLOG_PORT", "12201"))
_detected_service_name, _ = resolve_runtime_package_metadata()
_DEFAULT_SERVICE = _detected_service_name or __package_name__

_logger_config: dict[str, Any] = {
    "level": _DEFAULT_LEVEL,
    "service": _DEFAULT_SERVICE,
    "console": False,
    "file_path": None,
    "use_graylog": False,
    "graylog_host": _DEFAULT_GRAYLOG_HOST,
    "graylog_port": _DEFAULT_GRAYLOG_PORT,
}


class JsonFormatter(logging.Formatter):
    """Format log records as compact JSON payloads."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname.lower(),
            "logger": record.name,
            "service": getattr(record, "service", _logger_config["service"]),
            "message": record.getMessage(),
        }

        if record.exc_info:
            payload["error"] = self.formatException(record.exc_info)

        return json.dumps(payload, ensure_ascii=False)


class GraylogContextFilter(logging.Filter):
    """Inject consistent additional fields for Graylog payloads."""

    def filter(self, record: logging.LogRecord) -> bool:
        # Non-standard record attributes are exported by graypy as GELF extra fields.
        if not hasattr(record, "logger_name"):
            record.logger_name = record.name
        if not hasattr(record, "log_level"):
            record.log_level = record.levelname.lower()
        if not hasattr(record, "service"):
            record.service = _logger_config["service"]
        return True


def configure_logger(
    *,
    settings: LoggerSettings | None = None,
    force_reconfigure: bool = False,
) -> logging.Logger:
    """
    Configure the shared ``uns_kit`` logger and return it.

    Configure logger outputs from a single standardized ``settings`` object.

    Standardized settings can be provided via ``settings``:
    - ``service``: str
    - ``console``: bool
    - ``file_path``: str | None
    - ``graylog``: dict with ``host``, optional ``port`` and ``enabled``
      If ``graylog.host`` is set and ``enabled`` is omitted, Graylog is enabled.

    Reconfiguration is automatic when requested settings differ from the
    active logger state. Use ``force_reconfigure=True`` to rebuild handlers
    even when settings are unchanged (useful in tests or recovery paths).

    Example:
        configure_logger(
            settings={
                "level": "INFO",
                "service": "sandbox-app-py",
                "console": True,
                "file_path": "log/log.log",
                "graylog": {
                    "host": "10.128.7.241",
                    "port": 12201,
                },
            }
        )

        log = get_logger(__name__)
        log.info("started", extra={"device_id": "line-7"})
    """

    logger = logging.getLogger("uns_kit")
    desired = dict(_logger_config)

    if settings is not None:
        if "level" in settings and settings["level"] is not None:
            desired["level"] = settings["level"]
        if "service" in settings and settings["service"]:
            desired["service"] = str(settings["service"])
        if "console" in settings and settings["console"] is not None:
            desired["console"] = bool(settings["console"])
        if "file_path" in settings:
            desired["file_path"] = settings["file_path"]

        graylog_settings = settings.get("graylog")
        if graylog_settings is not None:
            if not isinstance(graylog_settings, dict):
                raise TypeError("settings['graylog'] must be a dict when provided.")
            if "host" in graylog_settings:
                desired["graylog_host"] = graylog_settings["host"]
            if "port" in graylog_settings and graylog_settings["port"] is not None:
                desired["graylog_port"] = int(graylog_settings["port"])
            if "enabled" in graylog_settings:
                desired["use_graylog"] = bool(graylog_settings["enabled"])
            elif graylog_settings.get("host"):
                desired["use_graylog"] = True

    should_reconfigure = force_reconfigure or not logger.handlers or desired != _logger_config
    if not should_reconfigure:
        return logger

    logger.handlers.clear()
    logger.setLevel(desired["level"])
    logger.propagate = False

    if desired["console"]:
        stream_handler = logging.StreamHandler(stream=sys.stdout)
        stream_handler.setLevel(desired["level"])
        stream_handler.setFormatter(JsonFormatter())
        logger.addHandler(stream_handler)

    if desired["file_path"]:
        file_dir = os.path.dirname(desired["file_path"])
        if file_dir:
            os.makedirs(file_dir, exist_ok=True)
        file_handler = TimedRotatingFileHandler(
            filename=desired["file_path"],
            when="midnight",
            interval=1,
            backupCount=60,
            encoding="utf-8",
        )
        file_handler.setLevel(desired["level"])
        file_handler.setFormatter(JsonFormatter())
        logger.addHandler(file_handler)

    if desired["use_graylog"]:
        if not desired["graylog_host"]:
            raise ValueError("graylog_host is required when use_graylog=True.")
        try:
            import graypy  # type: ignore[import-not-found]
        except ImportError as exc:
            raise ImportError(
                "graypy is not installed. Install it to use Graylog logging."
            ) from exc

        graylog_handler = graypy.GELFUDPHandler(desired["graylog_host"], desired["graylog_port"])
        graylog_handler.setLevel(desired["level"])
        graylog_handler.addFilter(GraylogContextFilter())
        logger.addHandler(graylog_handler)

    _logger_config.update(desired)
    return logger


def set_log_level(level: str | int) -> logging.Logger:
    """Set logger and handler levels while keeping current output targets."""

    return configure_logger(settings={"level": level})


def get_logger(name: str | None = None, level: str | int | None = None) -> logging.Logger:
    """Return the base logger or a named child logger, optionally overriding level."""

    base = configure_logger()
    logger = base if not name else base.getChild(name)
    if level is not None:
        logger.setLevel(level)
    return logger
