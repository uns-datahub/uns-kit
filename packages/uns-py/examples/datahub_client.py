from datetime import datetime, timedelta, timezone
from pathlib import Path

from uns_kit import ConfigFile, UnsClient


def main() -> None:
    cfg = ConfigFile.load_config(Path("config.json"))
    client = UnsClient(cfg["uns"]["rest"])

    value_topic = "sij/acroni/vv/hrm-furnace/equipment/pusher/output-quantity"
    table_topic = "sij/acroni/vv/hrm-furnace/process-segment/slab-001/trend-data"

    now = datetime.now(timezone.utc)
    from_ts = (now - timedelta(days=7)).isoformat().replace("+00:00", "Z")
    to_ts = now.isoformat().replace("+00:00", "Z")

    last_value = client.last_value(value_topic)
    print("last_value:")
    print(last_value)
    print()

    data = client.get_attribute_data(
        table_topic,
        from_=from_ts,
        to=to_ts,
        table="uns_hrm_furnace_trend_data_table",
        dedupe=False,
        summaryOnly=False,
    )
    print("get_data:")
    if data is None:
        print(None)
    else:
        print(data.records()[:3])
    print()

    custom_data = client.get_data(
        "/projects/project-name/path-to-data/data",
        params={"fromDate": "20260325"},
    )
    print("get_data:")
    print(custom_data)
    print()

    history = client.history(
        [value_topic, table_topic],
        from_=from_ts,
        to=to_ts,
        limit=500,
        dedupe=False,
        summaryOnly=False,
    )
    print("history:")
    if history is None:
        print(None)
    else:
        print(history.by_topic)


if __name__ == "__main__":
    main()
