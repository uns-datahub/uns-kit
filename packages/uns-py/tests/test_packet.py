from __future__ import annotations

import json

import pytest

from uns_kit import UnsPacket


TABLE_TIME = "2026-07-09T10:00:00.000Z"


def test_table_normalizes_transitional_legacy_columns_to_named_object() -> None:
    packet = UnsPacket.table(
        time=TABLE_TIME,
        data_group="metering",
        columns=[
            {
                "name": "active_energy_total",
                "type": "double",
                "value": 12345.6,
                "uom": "kWh",
            },
            {"name": "power", "type": "double", "value": 42.1, "uom": "kW"},
        ],
    )

    assert packet == {
        "version": "2.0.0",
        "message": {
            "table": {
                "time": TABLE_TIME,
                "dataGroup": "metering",
                "columns": {
                    "active_energy_total": {
                        "type": "double",
                        "value": 12345.6,
                        "uom": "kWh",
                    },
                    "power": {"type": "double", "value": 42.1, "uom": "kW"},
                },
            }
        },
    }


def test_table_accepts_named_column_object() -> None:
    packet = UnsPacket.table(
        table={
            "time": TABLE_TIME,
            "dataGroup": "metering",
            "columns": {
                "active_energy_total": {
                    "type": "double",
                    "value": 12345.6,
                    "uom": "kWh",
                },
                "power": {"type": "double", "value": 42.1, "uom": "kW"},
            },
        }
    )

    assert packet["version"] == "2.0.0"
    assert packet["message"]["table"]["columns"]["power"] == {
        "type": "double",
        "value": 42.1,
        "uom": "kW",
    }


def test_from_message_normalizes_transitional_legacy_columns() -> None:
    packet = UnsPacket.from_message(
        {
            "table": {
                "time": TABLE_TIME,
                "columns": [
                    {"name": "power", "type": "double", "value": 42.1, "uom": "kW"},
                ],
            }
        }
    )

    assert packet["version"] == "2.0.0"
    assert packet["message"]["table"]["columns"] == {
        "power": {"type": "double", "value": 42.1, "uom": "kW"}
    }


def test_parse_normalizes_legacy_v1_table_packet() -> None:
    raw_packet = json.dumps(
        {
            "version": "1.0.0",
            "message": {
                "table": {
                    "time": TABLE_TIME,
                    "columns": [
                        {
                            "name": "line speed",
                            "type": "double",
                            "value": 1.5,
                            "uom": "m/s",
                        }
                    ],
                }
            },
        }
    )

    packet = UnsPacket.parse(raw_packet)

    assert packet is not None
    assert packet["version"] == "1.0.0"
    assert packet["message"]["table"]["columns"] == {
        "line speed": {"type": "double", "value": 1.5, "uom": "m/s"}
    }


def test_parse_accepts_v2_named_column_object() -> None:
    raw_packet = json.dumps(
        {
            "version": "2.0.0",
            "message": {
                "table": {
                    "time": TABLE_TIME,
                    "columns": {
                        "power": {"type": "double", "value": 42.1, "uom": "kW"}
                    },
                }
            },
        }
    )

    packet = UnsPacket.parse(raw_packet)

    assert packet is not None
    assert packet["message"]["table"]["columns"]["power"]["value"] == 42.1


def test_parse_rejects_unsupported_packet_version() -> None:
    raw_packet = json.dumps({"version": "3.0.0", "message": {"data": {"value": 1}}})

    assert UnsPacket.parse(raw_packet) is None


def test_table_rejects_duplicate_legacy_column_names() -> None:
    with pytest.raises(ValueError, match="duplicate column name 'power'"):
        UnsPacket.table(
            time=TABLE_TIME,
            columns=[
                {"name": "power", "type": "double", "value": 42.1},
                {"name": "power", "type": "double", "value": 43.2},
            ],
        )


@pytest.mark.parametrize(
    ("columns", "message"),
    [
        ({"power": {"value": 42.1}}, r"table\.columns\.power\.type is required"),
        (
            {"power": {"type": "double"}},
            r"table\.columns\.power\.value is required",
        ),
        (
            {"power": {"type": "double", "value": []}},
            r"table\.columns\.power\.value must be",
        ),
        (
            {"line speed": {"type": "double", "value": 1.5}},
            "must match",
        ),
        (
            {"constructor": {"type": "string", "value": "bad"}},
            "is reserved",
        ),
        (
            {"power": {"name": "other", "type": "double", "value": 42.1}},
            "must not contain a name property",
        ),
        (
            {"power": {"type": "double", "value": 42.1, "uom": 10}},
            r"table\.columns\.power\.uom must be a string",
        ),
    ],
)
def test_table_rejects_invalid_named_columns(columns: dict, message: str) -> None:
    with pytest.raises(ValueError, match=message):
        UnsPacket.table(time=TABLE_TIME, columns=columns)
