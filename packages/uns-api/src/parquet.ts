import logger from "@uns-kit/core/logger.js";
import { randomUUID } from "crypto";
import fs from "fs";
import { type BasicType, type ColumnSource, fileWriter, parquetWriteRows } from "hyparquet-writer";
import os from "os";
import path from "path";

import type { DataCatalogSchemaRegistration } from "./api-interfaces.js";

export type CatalogParquetColumn = Omit<ColumnSource, "data">;

const PARQUET_TYPE_MAP: Record<string, BasicType> = {
  string: "STRING",
  number: "DOUBLE",
  integer: "INT64",
  boolean: "BOOLEAN",
  date: "TIMESTAMP",
  "date-time": "TIMESTAMP",
};

export async function writeSchemaRowsToParquet(input: {
  rows: Array<Record<string, unknown>>;
  schema: DataCatalogSchemaRegistration;
  outputDir?: string;
  fileName?: string;
}): Promise<string | null> {
  try {
    const outputDir = input.outputDir ?? path.join(os.tmpdir(), "uns-data-offers");
    const fileName = input.fileName ?? `${randomUUID()}.parquet`;
    const filePath = path.join(outputDir, fileName);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const columns = buildParquetSchemaFromCatalogSchema(input.schema);
    if (!columns.length) {
      throw new Error(`Parquet schema '${input.schema.id}' has no supported fields.`);
    }

    await parquetWriteRows({
      writer: fileWriter(filePath),
      rows: input.rows.map((row) => normalizeParquetRow(row, columns)),
      columns,
    });
    return filePath;
  } catch (error) {
    logger.error("Failed to write schema-driven parquet:", error);
    return null;
  }
}

export function buildParquetSchemaFromCatalogSchema(schema: DataCatalogSchemaRegistration): CatalogParquetColumn[] {
  const columns: CatalogParquetColumn[] = [];
  for (const field of schema.fields ?? []) {
    const parquetType = toParquetType(field.type ?? "string", field.format ?? null);
    if (!parquetType) {
      continue;
    }
    columns.push({
      name: field.name,
      type: parquetType,
      nullable: field.required !== true,
    });
  }
  return columns;
}

function toParquetType(type: string, format: string | null): BasicType | null {
  if (format && PARQUET_TYPE_MAP[format]) {
    return PARQUET_TYPE_MAP[format];
  }
  return PARQUET_TYPE_MAP[type] ?? null;
}

function normalizeParquetRow(row: Record<string, unknown>, columns: CatalogParquetColumn[]): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const column of columns) {
    const value = row[column.name];
    normalized[column.name] = column.type === "INT64" && typeof value === "number" ? BigInt(value) : value instanceof Date ? new Date(value) : value;
  }
  return normalized;
}
