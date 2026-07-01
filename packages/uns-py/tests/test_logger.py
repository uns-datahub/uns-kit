from __future__ import annotations

import logging

from uns_kit.core.logger import configure_logger, get_logger


def test_get_logger_uses_exact_external_name() -> None:
    root_logger = logging.getLogger()
    original_handlers = list(root_logger.handlers)
    original_level = root_logger.level

    try:
        configure_logger(
            settings={"level": "INFO", "console": False, "file_path": None},
            force_reconfigure=True,
        )

        logger = get_logger("app.application")

        assert logger.name == "app.application"
        assert logger.parent is root_logger
    finally:
        for handler in list(root_logger.handlers):
            if handler not in original_handlers:
                root_logger.removeHandler(handler)
                handler.close()
        root_logger.setLevel(original_level)
        for handler in original_handlers:
            if handler not in root_logger.handlers:
                root_logger.addHandler(handler)
