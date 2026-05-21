from __future__ import annotations

from pathlib import Path

from uns_kit.database import compile_named_params, create_database_client


def test_compile_named_params_handles_arrays_for_sqlite() -> None:
    statement = compile_named_params(
        "sqlite",
        "select * from metrics where id in (:ids) and status = :status",
        {"ids": [1, 2, 3], "status": "ok"},
    )

    assert statement.text == "select * from metrics where id in (?, ?, ?) and status = ?"
    assert statement.values == [1, 2, 3, "ok"]


def test_compile_named_params_uses_psycopg_placeholders_for_postgres() -> None:
    statement = compile_named_params(
        "pg",
        "select * from metrics where ts >= :fromDate and ts < :toDate and id in (:ids)",
        {"fromDate": "2026-05-19", "toDate": "2026-05-20", "ids": [1, 2]},
    )

    assert statement.text == "select * from metrics where ts >= %s and ts < %s and id in (%s, %s)"
    assert statement.values == ["2026-05-19", "2026-05-20", 1, 2]


def test_sqlite_database_client_executes_queries(tmp_path: Path) -> None:
    database_path = tmp_path / "test.sqlite"
    client = create_database_client({"dialect": "sqlite", "filename": str(database_path)})

    client.execute("create table metrics (id integer primary key, status text)")
    client.execute(
        "insert into metrics (id, status) values (:id, :status)",
        {"id": 1, "status": "ok"},
    )
    client.execute(
        "insert into metrics (id, status) values (:id, :status)",
        {"id": 2, "status": "bad"},
    )

    result = client.query(
        "select id, status from metrics where id in (:ids) order by id",
        {"ids": [1, 2]},
    )

    assert result.row_count == 2
    assert result.rows == [
        {"id": 1, "status": "ok"},
        {"id": 2, "status": "bad"},
    ]

    client.close()
