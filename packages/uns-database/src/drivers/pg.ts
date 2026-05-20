import type { DatabaseAdapter, DatabaseQueryResult } from "../types.js";
import type { CompiledSqlStatement } from "../types.js";
import type { PostgresDatabaseConfig } from "../schema.js";

type PgPool = {
  query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{
    rows: T[];
    rowCount?: number | null;
  }>;
  end(): Promise<void>;
};

type PgClient = {
  connect(): Promise<void>;
  query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{
    rows: T[];
    rowCount?: number | null;
  }>;
  end(): Promise<void>;
};

function buildPgSsl(config: PostgresDatabaseConfig): unknown {
  if (config.ssl === undefined) {
    return undefined;
  }

  if (typeof config.ssl === "boolean") {
    return config.ssl;
  }

  return {
    rejectUnauthorized: config.ssl.rejectUnauthorized,
    ca: config.ssl.ca,
    cert: config.ssl.cert,
    key: config.ssl.key,
    servername: config.ssl.servername,
  };
}

export async function createPgAdapter(config: PostgresDatabaseConfig): Promise<DatabaseAdapter> {
  let pgModule: {
    Pool: new (options: Record<string, unknown>) => PgPool;
    Client: new (options: Record<string, unknown>) => PgClient;
  };

  try {
    const importedModule = await import("pg");
    pgModule = ((importedModule as { default?: typeof importedModule }).default ??
      importedModule) as typeof pgModule;
  } catch (error) {
    throw new Error(
      "The 'pg' package is required for dialect 'pg'. Install it with `pnpm add pg`.",
      { cause: error as Error }
    );
  }

  const connectionOptions = {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: buildPgSsl(config),
    application_name: config.applicationName,
    statement_timeout: config.statementTimeoutMs,
    connectionTimeoutMillis: config.connectionTimeoutMs,
    idleTimeoutMillis: config.idleTimeoutMs,
    max: config.maxPoolSize,
    min: config.minPoolSize,
  };

  if (config.usePool !== false) {
    const pool = new pgModule.Pool(connectionOptions);

    return {
      dialect: "pg",
      async query<T = Record<string, unknown>>(statement: CompiledSqlStatement): Promise<DatabaseQueryResult<T>> {
        const result = await pool.query<T>(statement.text, statement.values as unknown[]);
        return {
          rows: result.rows,
          rowCount: result.rowCount ?? result.rows.length,
        };
      },
      async execute(statement: CompiledSqlStatement) {
        const result = await pool.query(statement.text, statement.values as unknown[]);
        return {
          rowCount: result.rowCount ?? 0,
        };
      },
      close() {
        return pool.end();
      },
    };
  }

  const client = new pgModule.Client(connectionOptions);
  await client.connect();

  return {
    dialect: "pg",
    async query<T = Record<string, unknown>>(statement: CompiledSqlStatement): Promise<DatabaseQueryResult<T>> {
      const result = await client.query<T>(statement.text, statement.values as unknown[]);
      return {
        rows: result.rows,
        rowCount: result.rowCount ?? result.rows.length,
      };
    },
    async execute(statement: CompiledSqlStatement) {
      const result = await client.query(statement.text, statement.values as unknown[]);
      return {
        rowCount: result.rowCount ?? 0,
      };
    },
    close() {
      return client.end();
    },
  };
}
