export type DatabaseDialect = "pg" | "sqlite" | "oracle";

export type SqlParams = Record<string, unknown>;

export interface CompiledSqlStatement {
  text: string;
  values: unknown[] | Record<string, unknown>;
  parameterOrder: string[];
}

export interface DatabaseQueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

export interface DatabaseExecuteResult {
  rowCount: number;
}

export interface DatabaseClient {
  readonly dialect: DatabaseDialect;
  readonly name?: string;
  readonly sqlDir?: string;
  query<T = Record<string, unknown>>(sqlText: string, params?: SqlParams): Promise<DatabaseQueryResult<T>>;
  execute(sqlText: string, params?: SqlParams): Promise<DatabaseExecuteResult>;
  queryFile<T = Record<string, unknown>>(filePath: string, params?: SqlParams): Promise<DatabaseQueryResult<T>>;
  executeFile(filePath: string, params?: SqlParams): Promise<DatabaseExecuteResult>;
  close(): Promise<void>;
}

export interface DatabaseAdapter {
  readonly dialect: DatabaseDialect;
  query<T = Record<string, unknown>>(statement: CompiledSqlStatement): Promise<DatabaseQueryResult<T>>;
  execute(statement: CompiledSqlStatement): Promise<DatabaseExecuteResult>;
  close(): Promise<void>;
}
