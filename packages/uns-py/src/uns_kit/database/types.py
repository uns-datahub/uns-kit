from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal, Protocol

DatabaseDialect = Literal["pg", "sqlite", "oracle"]
SqlParams = dict[str, Any]


@dataclass(frozen=True)
class CompiledSqlStatement:
    text: str
    values: list[Any] | dict[str, Any]
    parameter_order: list[str]


@dataclass(frozen=True)
class DatabaseQueryResult:
    rows: list[dict[str, Any]]
    row_count: int


@dataclass(frozen=True)
class DatabaseExecuteResult:
    row_count: int


class DatabaseAdapter(Protocol):
    dialect: DatabaseDialect

    def query(self, statement: CompiledSqlStatement) -> DatabaseQueryResult: ...

    def execute(self, statement: CompiledSqlStatement) -> DatabaseExecuteResult: ...

    def close(self) -> None: ...


class DatabaseClient(Protocol):
    dialect: DatabaseDialect
    name: str | None
    sql_dir: str | None

    def query(self, sql_text: str, params: SqlParams | None = None) -> DatabaseQueryResult: ...

    def execute(self, sql_text: str, params: SqlParams | None = None) -> DatabaseExecuteResult: ...

    def query_file(self, file_path: str, params: SqlParams | None = None) -> DatabaseQueryResult: ...

    def execute_file(self, file_path: str, params: SqlParams | None = None) -> DatabaseExecuteResult: ...

    def close(self) -> None: ...
