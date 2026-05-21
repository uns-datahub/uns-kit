from __future__ import annotations

from typing import Any, TypedDict

from ..core.config_schema import any_of, boolean_schema, enum_schema, host_value_schema, integer_schema, record_schema, secret_value_schema, strict_object, string_schema


class PostgresDatabaseConfig(TypedDict, total=False):
    dialect: str
    host: Any
    port: int
    database: str
    user: str
    password: Any
    usePool: bool
    ssl: bool | dict[str, Any]
    sqlDir: str
    applicationName: str
    statementTimeoutMs: int
    connectionTimeoutMs: int
    idleTimeoutMs: int
    maxPoolSize: int
    minPoolSize: int


class SqliteDatabaseConfig(TypedDict, total=False):
    dialect: str
    filename: str
    sqlDir: str
    readonly: bool
    fileMustExist: bool
    timeoutMs: int


class OracleDatabaseConfig(TypedDict, total=False):
    dialect: str
    user: str
    password: Any
    usePool: bool
    connectString: str
    host: Any
    port: int
    serviceName: str
    sid: str
    sqlDir: str
    poolMin: int
    poolMax: int
    poolIncrement: int
    stmtCacheSize: int


DatabaseConnectionConfig = PostgresDatabaseConfig | SqliteDatabaseConfig | OracleDatabaseConfig

_sql_dir_schema = string_schema(min_length=1)
_ssl_mode_schema = any_of(
    boolean_schema(),
    strict_object(
        {
            "rejectUnauthorized": boolean_schema(default=True),
            "ca": string_schema(),
            "cert": string_schema(),
            "key": string_schema(),
            "servername": string_schema(),
        }
    ),
)

postgres_database_schema = strict_object(
    {
        "dialect": {"const": "pg", "type": "string"},
        "host": host_value_schema,
        "port": integer_schema(exclusive_minimum=0, default=5432),
        "database": string_schema(min_length=1),
        "user": string_schema(min_length=1),
        "password": secret_value_schema,
        "usePool": boolean_schema(default=True),
        "ssl": _ssl_mode_schema,
        "sqlDir": _sql_dir_schema,
        "applicationName": string_schema(min_length=1),
        "statementTimeoutMs": integer_schema(minimum=0),
        "connectionTimeoutMs": integer_schema(minimum=0),
        "idleTimeoutMs": integer_schema(minimum=0),
        "maxPoolSize": integer_schema(exclusive_minimum=0),
        "minPoolSize": integer_schema(minimum=0),
    },
    required=["dialect", "host", "database", "user"],
)

sqlite_database_schema = strict_object(
    {
        "dialect": {"const": "sqlite", "type": "string"},
        "filename": string_schema(min_length=1),
        "sqlDir": _sql_dir_schema,
        "readonly": boolean_schema(),
        "fileMustExist": boolean_schema(),
        "timeoutMs": integer_schema(minimum=0),
    },
    required=["dialect", "filename"],
)

oracle_database_schema = strict_object(
    {
        "dialect": {"const": "oracle", "type": "string"},
        "user": string_schema(min_length=1),
        "password": secret_value_schema,
        "usePool": boolean_schema(default=True),
        "connectString": string_schema(min_length=1),
        "host": host_value_schema,
        "port": integer_schema(exclusive_minimum=0, default=1521),
        "serviceName": string_schema(min_length=1),
        "sid": string_schema(min_length=1),
        "sqlDir": _sql_dir_schema,
        "poolMin": integer_schema(minimum=0),
        "poolMax": integer_schema(exclusive_minimum=0),
        "poolIncrement": integer_schema(exclusive_minimum=0),
        "stmtCacheSize": integer_schema(exclusive_minimum=0),
    },
    required=["dialect", "user"],
)

database_connection_schema = {
    "oneOf": [
        postgres_database_schema,
        sqlite_database_schema,
        oracle_database_schema,
    ]
}
databases_config_schema = record_schema(database_connection_schema)
database_project_extras_schema = strict_object(
    {
        "databases": databases_config_schema,
    },
    required=["databases"],
)


def normalize_database_config(config: dict[str, Any]) -> DatabaseConnectionConfig:
    dialect = config.get("dialect")
    if dialect == "pg":
        normalized = dict(config)
        normalized.setdefault("port", 5432)
        normalized.setdefault("usePool", True)
        return normalized
    if dialect == "sqlite":
        return dict(config)
    if dialect == "oracle":
        normalized = dict(config)
        normalized.setdefault("port", 1521)
        normalized.setdefault("usePool", True)
        if not normalized.get("connectString") and not normalized.get("host"):
            raise ValueError("oracle connection requires either connectString or host")
        if not normalized.get("connectString") and not normalized.get("serviceName") and not normalized.get("sid"):
            raise ValueError("oracle connection requires serviceName or sid when connectString is omitted")
        return normalized
    raise ValueError(f"Unsupported database dialect: {dialect}")
