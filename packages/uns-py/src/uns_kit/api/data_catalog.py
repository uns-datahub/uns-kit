from __future__ import annotations

import io
from pathlib import Path
from typing import Any

from .interfaces import DataCatalogSchemaRegistration


def project_rows_for_data_catalog_schema(
    rows: list[dict[str, Any]],
    schema: DataCatalogSchemaRegistration,
) -> list[dict[str, Any]]:
    leaf_fields = [field for field in (schema.fields or []) if field.type != "array"]
    projected_rows: list[dict[str, Any]] = []
    for row in rows:
        projected: dict[str, Any] = {}
        for field in leaf_fields:
            source_key = (field.source_key or "").strip() or field.name
            projected[field.name] = _get_row_value(row, source_key)
        projected_rows.append(projected)
    return projected_rows


def write_schema_rows_to_parquet(
    *,
    rows: list[dict[str, Any]],
    schema: DataCatalogSchemaRegistration,
    output_path: str | Path | None = None,
) -> bytes:
    import pandas as pd

    leaf_fields = [field for field in (schema.fields or []) if field.type != "array"]
    ordered_columns = [field.name for field in leaf_fields]
    normalized_rows = [{column: row.get(column) for column in ordered_columns} for row in rows]

    buffer = io.BytesIO()
    pd.DataFrame(normalized_rows, columns=ordered_columns).to_parquet(buffer, index=False)
    payload = buffer.getvalue()

    if output_path is not None:
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(payload)

    return payload


def _get_row_value(row: dict[str, Any], key: str) -> Any:
    if key in row:
        return row[key]
    normalized_key = key.lower()
    for candidate, value in row.items():
        if candidate.lower() == normalized_key:
            return value
    return None
