from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Optional

from .secret_resolver import (
    SecretResolverOptions,
    clear_secret_resolver_caches,
    resolve_config_secrets,
)


class ConfigFile:
    _raw_cache: Optional[Dict[str, Any]] = None
    _raw_path: Optional[Path] = None
    _resolved_cache: Optional[Dict[str, Any]] = None

    @classmethod
    def load_raw_config(cls, config_path: Optional[Path | str] = None) -> Dict[str, Any]:
        p = Path(config_path) if config_path is not None else Path.cwd() / "config.json"
        p = p.resolve()
        if cls._raw_cache is None or cls._raw_path != p:
            cls._raw_cache = json.loads(p.read_text(encoding="utf-8"))
            cls._raw_path = p
            cls._resolved_cache = None
        return cls._raw_cache

    @classmethod
    def get(cls) -> Dict[str, Any]:
        if cls._raw_cache is None:
            raise ValueError("Config not loaded. Call ConfigFile.load_config() first.")
        return cls._raw_cache

    @classmethod
    def load_config(
        cls,
        config_path: Optional[Path | str] = None,
        options: Optional[SecretResolverOptions] = None,
    ) -> Dict[str, Any]:
        raw = cls.load_raw_config(config_path)
        if cls._resolved_cache is None:
            cls._resolved_cache = resolve_config_secrets(raw, options)
        return cls._resolved_cache

    @classmethod
    def load_resolved_config(
        cls,
        options: Optional[SecretResolverOptions] = None,
    ) -> Dict[str, Any]:
        return cls.load_config(None, options)

    @classmethod
    def clear_cache(cls) -> None:
        cls._raw_cache = None
        cls._resolved_cache = None
        cls._raw_path = None
        clear_secret_resolver_caches()
