from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from .version import __package_name__, __version__


@dataclass(frozen=True)
class RuntimeMetadata:
    package_name: str
    package_version: str

def resolve_runtime_package_metadata(start_path: Path | None = None) -> tuple[str | None, str | None]:
    """Resolve runtime package metadata from the nearest package.json."""
    current = (start_path or Path.cwd()).resolve()
    search_dirs = [current] + list(current.parents)
    for directory in search_dirs:
        package_json = directory / "package.json"
        if not package_json.exists():
            continue
        try:
            payload = json.loads(package_json.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(payload, dict):
            continue
        name = payload.get("name")
        version = payload.get("version")
        resolved_name = str(name) if isinstance(name, str) and name.strip() else None
        resolved_version = str(version) if isinstance(version, str) and version.strip() else None
        return resolved_name, resolved_version
    return None, None


_detected_package_name, _detected_package_version = resolve_runtime_package_metadata()
RUNTIME_METADATA = RuntimeMetadata(
    package_name=_detected_package_name or __package_name__,
    package_version=_detected_package_version or __version__
)


def get_runtime_metadata() -> RuntimeMetadata:
    """Return cached runtime metadata resolved at import time."""
    return RUNTIME_METADATA
