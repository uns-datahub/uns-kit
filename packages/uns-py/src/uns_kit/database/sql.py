from __future__ import annotations

from pathlib import Path


def load_sql_file(file_path: str, *, base_dir: str | None = None) -> str:
    resolved_path = resolve_sql_file_path(file_path, base_dir=base_dir)
    return Path(resolved_path).read_text(encoding="utf-8")


def resolve_sql_file_path(file_path: str, *, base_dir: str | None = None) -> str:
    path = Path(file_path)
    if path.is_absolute():
        return str(path)
    base = Path(base_dir) if base_dir else Path.cwd()
    return str((base / path).resolve())
