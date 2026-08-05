import fs from "fs/promises";
import { asyncBufferFromFile, parquetReadObjects } from "hyparquet";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import type { DataCatalogSchemaRegistration } from "../packages/uns-api/src/api-interfaces.js";
import { buildParquetSchemaFromCatalogSchema, writeSchemaRowsToParquet } from "../packages/uns-api/src/parquet.js";

const temporaryDirectories: string[] = [];

const schema: DataCatalogSchemaRegistration = {
  id: "machine-events",
  title: "Machine events",
  fields: [
    { name: "name", type: "string", required: true },
    { name: "count", type: "integer", required: true },
    { name: "temperature", type: "number" },
    { name: "running", type: "boolean" },
    { name: "recordedAt", type: "string", format: "date-time", required: true },
    { name: "metadata", type: "object" },
  ],
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe("schema-driven Parquet writer", () => {
  it("maps supported catalog fields to typed nullable columns", () => {
    expect(buildParquetSchemaFromCatalogSchema(schema)).toEqual([
      { name: "name", type: "STRING", nullable: false },
      { name: "count", type: "INT64", nullable: false },
      { name: "temperature", type: "DOUBLE", nullable: true },
      { name: "running", type: "BOOLEAN", nullable: true },
      { name: "recordedAt", type: "TIMESTAMP", nullable: false },
    ]);
  });

  it("writes a readable Parquet file without the vulnerable Thrift dependency", async () => {
    const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "uns-kit-parquet-"));
    temporaryDirectories.push(outputDir);
    const recordedAt = new Date("2026-08-05T10:15:00.000Z");

    const filePath = await writeSchemaRowsToParquet({
      outputDir,
      fileName: "machine-events.parquet",
      schema,
      rows: [
        {
          name: "press-01",
          count: 12,
          temperature: 42.5,
          running: true,
          recordedAt,
          metadata: { ignored: true },
        },
      ],
    });

    expect(filePath).toBe(path.join(outputDir, "machine-events.parquet"));
    const rows = await parquetReadObjects({
      file: await asyncBufferFromFile(filePath!),
    });
    expect(rows).toEqual([
      {
        name: "press-01",
        count: 12n,
        temperature: 42.5,
        running: true,
        recordedAt,
      },
    ]);
  });
});
