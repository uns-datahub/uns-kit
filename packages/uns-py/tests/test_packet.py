from __future__ import annotations

import pytest

from uns_kit import UnsPacket


def test_table_preserves_legacy_column_list_shape() -> None:
    packet = UnsPacket.table(
        time="2026-07-09T10:00:00.000Z",
        data_group="metering",
        columns=[
            {"name": "active_energy_total", "type": "double", "value": 12345.6, "uom": "kWh"},
            {"name": "power", "value": 42.1, "uom": "kW"},
        ],
    )

    assert packet["message"]["table"]["columns"] == [
        {"name": "active_energy_total", "type": "double", "value": 12345.6, "uom": "kWh"},
        {"name": "power", "value": 42.1, "uom": "kW"},
    ]


def test_table_accepts_named_column_object() -> None:
    packet = UnsPacket.table(
        table={
            "time": "2026-07-09T10:00:00.000Z",
            "dataGroup": "metering",
            "columns": {
                "active_energy_total": {"type": "double", "value": 12345.6, "uom": "kWh"},
                "power": {"value": 42.1, "uom": "kW"},
            },
        }
    )

    assert packet["message"]["table"]["columns"]["power"]["value"] == 42.1
    assert "type" not in packet["message"]["table"]["columns"]["power"]


def test_from_message_preserves_legacy_column_list_shape() -> None:
    packet = UnsPacket.from_message(
        {
            "table": {
                "time": "2026-07-09T10:00:00.000Z",
                "columns": [
                    {"name": "power", "value": 42.1, "uom": "kW"},
                ],
            }
        }
    )

    assert packet["message"]["table"]["columns"] == [
        {"name": "power", "value": 42.1, "uom": "kW"},
    ]


def test_table_rejects_duplicate_legacy_column_names() -> None:
    with pytest.raises(ValueError, match="duplicate column name 'power'"):
        UnsPacket.table(
            time="2026-07-09T10:00:00.000Z",
            columns=[
                {"name": "power", "value": 42.1},
                {"name": "power", "value": 43.2},
            ],
        )
