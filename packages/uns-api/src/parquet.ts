import { randomUUID } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { ParquetSchema, ParquetWriter } from "parquets";
import logger from "@uns-kit/core/logger.js";
import type { DataCatalogSchemaRegistration } from "./api-interfaces.js";

const PARQUET_TYPE_MAP: Record<string, string> = {
  string: "UTF8",
  number: "DOUBLE",
  integer: "INT64",
  boolean: "BOOLEAN",
  date: "TIMESTAMP_MILLIS",
  "date-time": "TIMESTAMP_MILLIS",
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

    const writer = await ParquetWriter.openFile(buildParquetSchemaFromCatalogSchema(input.schema), filePath);
    for (const row of input.rows) {
      await writer.appendRow(normalizeParquetRow(row));
    }
    await writer.close();
    return filePath;
  } catch (error) {
    logger.error("Failed to write schema-driven parquet:", error);
    return null;
  }
}

export function buildParquetSchemaFromCatalogSchema(schema: DataCatalogSchemaRegistration): any {
  const schemaDef: Record<string, { type: string; optional: boolean }> = {};
  for (const field of schema.fields ?? []) {
    const parquetType = toParquetType(field.type ?? "string", field.format ?? null);
    if (!parquetType) {
      continue;
    }
    schemaDef[field.name] = {
      type: parquetType,
      optional: field.required !== true,
    };
  }
  return new ParquetSchema(schemaDef);
}

function toParquetType(type: string, format: string | null): string | null {
  if (format && PARQUET_TYPE_MAP[format]) {
    return PARQUET_TYPE_MAP[format];
  }
  return PARQUET_TYPE_MAP[type] ?? null;
}

function normalizeParquetRow(row: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key] = value instanceof Date ? new Date(value) : value;
  }
  return normalized;
}
