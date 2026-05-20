import type { DatabaseAdapter, DatabaseQueryResult } from "../types.js";
import type { CompiledSqlStatement } from "../types.js";
import type { SqliteDatabaseConfig } from "../schema.js";

type BetterSqliteStatement = {
  all(...params: unknown[]): Record<string, unknown>[];
  run(...params: unknown[]): { changes: number };
};

type BetterSqliteDatabase = {
  pragma(value: string): void;
  prepare(sqlText: string): BetterSqliteStatement;
  close(): void;
};

type BetterSqliteConstructor = new (
  filename: string,
  options?: {
    readonly?: boolean;
    fileMustExist?: boolean;
    timeout?: number;
  }
) => BetterSqliteDatabase;

export async function createSqliteAdapter(config: SqliteDatabaseConfig): Promise<DatabaseAdapter> {
  let sqliteModule: { default: BetterSqliteConstructor };

  try {
    sqliteModule = await import("better-sqlite3");
  } catch (error) {
    throw new Error(
      "The 'better-sqlite3' package is required for dialect 'sqlite'. Install it with `pnpm add better-sqlite3`.",
      { cause: error as Error }
    );
  }

  const Database = sqliteModule.default;
  const db = new Database(config.filename, {
    readonly: config.readonly,
    fileMustExist: config.fileMustExist,
    timeout: config.timeoutMs,
  });

  db.pragma("journal_mode = WAL");

  return {
    dialect: "sqlite",
    async query<T = Record<string, unknown>>(statement: CompiledSqlStatement): Promise<DatabaseQueryResult<T>> {
      const prepared = db.prepare(statement.text);
      const rows = prepared.all(...(statement.values as unknown[])) as T[];
      return {
        rows,
        rowCount: rows.length,
      };
    },
    async execute(statement: CompiledSqlStatement) {
      const prepared = db.prepare(statement.text);
      const result = prepared.run(...(statement.values as unknown[]));
      return {
        rowCount: result.changes ?? 0,
      };
    },
    async close() {
      db.close();
    },
  };
}
