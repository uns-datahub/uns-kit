from __future__ import annotations

try:  # pragma: no cover - best-effort metadata fetch
    from importlib.metadata import metadata, version

    __package_name__ = metadata("uns-kit").get("Name", "uns-kit")
    __version__ = version("uns-kit")
except Exception:  # fallback for editable/local
    __package_name__ = "uns-kit"
    __version__ = "0.0.0"

