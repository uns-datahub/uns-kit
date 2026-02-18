from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any

_DEFAULT_LEVEL = os.getenv("UNS_LOG_LEVEL", "INFO").upper()


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname.lower(),
            "logger": record.name,
            "message": record.getMessage(),
        }

        if record.exc_info:
            payload["error"] = self.formatException(record.exc_info)

        return json.dumps(payload, ensure_ascii=False)


def configure_logger() -> logging.Logger:
    logger = logging.getLogger("uns_kit")
    if logger.handlers:
        return logger

    logger.setLevel(_DEFAULT_LEVEL)
    logger.propagate = False

    handler = logging.StreamHandler(stream=sys.stdout)
    handler.setFormatter(JsonFormatter())
    logger.addHandler(handler)
    return logger


def set_log_level(level: str | int) -> logging.Logger:
    logger = configure_logger()
    logger.setLevel(level)
    for handler in logger.handlers:
        handler.setLevel(level)
    return logger


def get_logger(name: str | None = None, level: str | int | None = None) -> logging.Logger:
    base = configure_logger()
    logger = base if not name else base.getChild(name)
    if level is not None:
        logger.setLevel(level)
    return logger


logger = configure_logger()
