from __future__ import annotations

try:  # pragma: no cover - best-effort metadata fetch
    from importlib.metadata import version

    __version__ = version("uns-kit")
except Exception:  # fallback for editable/local
    __version__ = "0.0.0"

