import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  compileNamedParams,
  databasesConfigSchema,
  getDatabaseManager,
  registerDatabase,
  loadSqlFile,
} from "../packages/uns-database/src/index.js";
import { buildSqliteOpenOptions } from "../packages/uns-database/src/drivers/sqlite.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(dir =>
      fs.rm(dir, { recursive: true, force: true })
    )
  );
});

describe("@uns-kit/database", () => {
  it("omits undefined options rejected by better-sqlite3", () => {
    expect(buildSqliteOpenOptions({ dialect: "sqlite", filename: ":memory:" })).toEqual({});
  });

  it("maps configured SQLite open options", () => {
    expect(buildSqliteOpenOptions({
      dialect: "sqlite",
      filename: "runtime.sqlite",
      readonly: false,
      fileMustExist: true,
      timeoutMs: 1_500,
    })).toEqual({
      readonly: false,
      fileMustExist: true,
      timeout: 1_500,
    });
  });

  it("compiles portable named params for postgres", () => {
    const statement = compileNamedParams(
      "pg",
      "select * from orders where line_id = :lineId and created_at >= :fromTs and line_id = :lineId",
      { lineId: "L1", fromTs: "2026-05-20T08:00:00Z" }
    );

    expect(statement.text).toBe(
      "select * from orders where line_id = $1 and created_at >= $2 and line_id = $1"
    );
    expect(statement.values).toEqual(["L1", "2026-05-20T08:00:00Z"]);
  });

  it("preserves oracle bind style and ignores casts/comments", () => {
    const statement = compileNamedParams(
      "oracle",
      "select :lineId as line_id, created_at::text from orders -- :skipMe",
      { lineId: "L1" }
    );

    expect(statement.text).toBe(
      "select :lineId as line_id, created_at::text from orders -- :skipMe"
    );
    expect(statement.values).toEqual({ lineId: "L1" });
  });

  it("expands arrays for IN clauses and rewrites oracle chunked conditions", () => {
    const pgStatement = compileNamedParams(
      "pg",
      "select * from orders where line_id in (:lineIds) and state = :state",
      { lineIds: ["L1", "L2", "L3"], state: "OPEN" }
    );

    expect(pgStatement.text).toBe(
      "select * from orders where line_id in ($1, $2, $3) and state = $4"
    );
    expect(pgStatement.values).toEqual(["L1", "L2", "L3", "OPEN"]);

    const oracleStatement = compileNamedParams(
      "oracle",
      "select * from orders where line_id in (:lineIds)",
      { lineIds: ["L1", "L2"] }
    );

    expect(oracleStatement.text).toBe(
      "select * from orders where (line_id IN (:lineIds_0_0, :lineIds_0_1))"
    );
    expect(oracleStatement.values).toEqual({
      lineIds_0_0: "L1",
      lineIds_0_1: "L2",
    });
  });

  it("keeps one named-parameter style across all drivers", () => {
    const sqliteStatement = compileNamedParams(
      "sqlite",
      "select * from orders where line_id = :lineId and state = :state",
      { lineId: "L1", state: "OPEN" }
    );

    const oracleStatement = compileNamedParams(
      "oracle",
      "select * from orders where line_id = :lineId and state = :state",
      { lineId: "L1", state: "OPEN" }
    );

    expect(sqliteStatement.text).toBe(
      "select * from orders where line_id = ? and state = ?"
    );
    expect(sqliteStatement.values).toEqual(["L1", "OPEN"]);
    expect(oracleStatement.text).toBe(
      "select * from orders where line_id = :lineId and state = :state"
    );
    expect(oracleStatement.values).toEqual({ lineId: "L1", state: "OPEN" });
  });

  it("loads sql files relative to a base dir", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "uns-db-"));
    tempDirs.push(dir);

    const sqlDir = path.join(dir, "sql", "queries");
    await fs.mkdir(sqlDir, { recursive: true });
    await fs.writeFile(
      path.join(sqlDir, "find-orders.sql"),
      "select * from orders where line_id = :lineId",
      "utf8"
    );

    const sqlText = await loadSqlFile("queries/find-orders.sql", {
      baseDir: path.join(dir, "sql"),
    });

    expect(sqlText).toBe("select * from orders where line_id = :lineId");
  });

  it("validates reusable databases config", () => {
    const parsed = databasesConfigSchema.parse({
      main: {
        dialect: "pg",
        host: { provider: "inline", value: "localhost" },
        port: 5432,
        database: "factory",
        user: "app_user",
        password: { provider: "env", key: "PG_PASSWORD" },
        usePool: false,
        sqlDir: "./sql",
      },
      reporting: {
        dialect: "sqlite",
        filename: "./data/reporting.sqlite",
      },
    });

    expect(parsed.main.dialect).toBe("pg");
    expect(parsed.reporting.dialect).toBe("sqlite");
    expect(parsed.main.usePool).toBe(false);
  });

  it("keeps a reusable default database manager registry", () => {
    const manager = getDatabaseManager();
    registerDatabase("main", {
      dialect: "sqlite",
      filename: "./data/main.sqlite",
    });
    registerDatabase("reporting", {
      dialect: "pg",
      host: "localhost",
      port: 5432,
      database: "reporting",
      user: "report_user",
    });

    expect(manager).toBe(getDatabaseManager());
    expect(manager.has("main")).toBe(true);
    expect(manager.has("reporting")).toBe(true);
    expect(manager.getNames()).toEqual(["main", "reporting"]);
  });
});
