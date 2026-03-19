from __future__ import annotations

from pathlib import Path
import re

try:  # pragma: no cover - best-effort metadata fetch
    from importlib.metadata import metadata, version

    __package_name__ = metadata("uns-kit").get("Name", "uns-kit")
    __version__ = version("uns-kit")
except Exception:  # fallback for editable/local
    __package_name__ = "uns-kit"
    pyproject_path = Path(__file__).resolve().parents[2] / "pyproject.toml"
    try:
        pyproject_text = pyproject_path.read_text(encoding="utf-8")
        match = re.search(r'(?m)^version\s*=\s*"([^"]+)"\s*$', pyproject_text)
        __version__ = match.group(1) if match else "0.0.0"
    except Exception:
        __version__ = "0.0.0"
