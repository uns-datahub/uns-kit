import path from "node:path";
import logger from "@uns-kit/core/logger.js";
import type { DatabaseConnectionConfig } from "./schema.js";
import { compileNamedParams } from "./params.js";
import { loadSqlFile } from "./sql.js";
import type {
  DatabaseAdapter,
  DatabaseClient,
  DatabaseExecuteResult,
  DatabaseQueryResult,
  SqlParams,
} from "./types.js";
import { createPgAdapter } from "./drivers/pg.js";
import { createSqliteAdapter } from "./drivers/sqlite.js";
import { createOracleAdapter } from "./drivers/oracle.js";

class DatabaseClientImpl implements DatabaseClient {
  readonly dialect;
  readonly name?;
  readonly sqlDir?;

  constructor(
    private readonly adapter: DatabaseAdapter,
    name?: string,
    sqlDir?: string
  ) {
    this.dialect = adapter.dialect;
    this.name = name;
    this.sqlDir = sqlDir;
  }

  async query<T = Record<string, unknown>>(
    sqlText: string,
    params: SqlParams = {}
  ): Promise<DatabaseQueryResult<T>> {
    const statement = compileNamedParams(this.dialect, sqlText, params);
    return this.adapter.query<T>(statement);
  }

  async execute(
    sqlText: string,
    params: SqlParams = {}
  ): Promise<DatabaseExecuteResult> {
    const statement = compileNamedParams(this.dialect, sqlText, params);
    return this.adapter.execute(statement);
  }

  async queryFile<T = Record<string, unknown>>(
    filePath: string,
    params: SqlParams = {}
  ): Promise<DatabaseQueryResult<T>> {
    const sqlText = await loadSqlFile(filePath, { baseDir: this.sqlDir });
    return this.query<T>(sqlText, params);
  }

  async executeFile(
    filePath: string,
    params: SqlParams = {}
  ): Promise<DatabaseExecuteResult> {
    const sqlText = await loadSqlFile(filePath, { baseDir: this.sqlDir });
    return this.execute(sqlText, params);
  }

  async close(): Promise<void> {
    await this.adapter.close();
  }
}

export async function createDatabaseClient(
  config: DatabaseConnectionConfig,
  options: { name?: string } = {}
): Promise<DatabaseClient> {
  const sqlDir = config.sqlDir
    ? path.resolve(process.cwd(), config.sqlDir)
    : undefined;

  logger.info(
    `uns-database - Creating database client: ${options.name ?? "unnamed"} (${config.dialect}, pool=${config.dialect === "sqlite" ? "n/a" : config.usePool !== false})`
  );

  switch (config.dialect) {
    case "pg":
      return new DatabaseClientImpl(await createPgAdapter(config), options.name, sqlDir);
    case "sqlite":
      return new DatabaseClientImpl(await createSqliteAdapter(config), options.name, sqlDir);
    case "oracle":
      return new DatabaseClientImpl(await createOracleAdapter(config), options.name, sqlDir);
  }

  throw new Error(`Unsupported database dialect: ${String((config as { dialect?: string }).dialect)}`);
}

export class DatabaseManager {
  private readonly configs = new Map<string, DatabaseConnectionConfig>();
  private readonly clients = new Map<string, Promise<DatabaseClient>>();

  register(name: string, config: DatabaseConnectionConfig): this {
    const hadExistingConfig = this.configs.has(name);
    const hadExistingClient = this.clients.has(name);

    this.configs.set(name, config);
    this.clients.delete(name);

    logger.info(
      hadExistingConfig
        ? `uns-database - Re-registered database: ${name} (${config.dialect}, pool=${config.dialect === "sqlite" ? "n/a" : config.usePool !== false}, replacedClient=${hadExistingClient})`
        : `uns-database - Registered database: ${name} (${config.dialect}, pool=${config.dialect === "sqlite" ? "n/a" : config.usePool !== false})`
    );

    return this;
  }

  has(name: string): boolean {
    return this.configs.has(name);
  }

  getNames(): string[] {
    return Array.from(this.configs.keys());
  }

  async get(name: string): Promise<DatabaseClient> {
    const existing = this.clients.get(name);
    if (existing) {
      logger.info(`uns-database - Reusing cached database client: ${name}`);
      return existing;
    }

    const config = this.configs.get(name);
    if (!config) {
      throw new Error(`Database connection '${name}' is not configured.`);
    }

    const clientPromise = createDatabaseClient(config, { name }).catch((error) => {
      this.clients.delete(name);
      logger.error(`uns-database - Database client initialization failed: ${name}`, error);
      throw error;
    });
    this.clients.set(name, clientPromise);
    logger.info(`uns-database - Initialized database client cache entry: ${name} (${config.dialect})`);
    return clientPromise;
  }

  async close(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (!client) {
      logger.info(`uns-database - Close requested for database without active client: ${name}`);
      return;
    }

    this.clients.delete(name);
    await (await client).close();
    logger.info(`uns-database - Closed database client: ${name}`);
  }

  async closeAll(): Promise<void> {
    const pendingClients = Array.from(this.clients.values());
    const count = pendingClients.length;
    this.clients.clear();
    await Promise.all(pendingClients.map(async client => (await client).close()));
    logger.info(`uns-database - Closed all database clients (${count})`);
  }
}

const defaultDatabaseManager = new DatabaseManager();

export function registerDatabase(name: string, config: DatabaseConnectionConfig): DatabaseManager {
  return defaultDatabaseManager.register(name, config);
}

export function getDatabaseManager(): DatabaseManager {
  return defaultDatabaseManager;
}

export function getDatabase(name: string): Promise<DatabaseClient> {
  return defaultDatabaseManager.get(name);
}
