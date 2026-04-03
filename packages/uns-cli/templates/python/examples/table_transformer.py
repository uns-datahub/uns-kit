from gateway.client import Client, iso_now
import time

client = Client()
client.publish_table(
    topic="sensors/summary/",
    attribute="room1",
    obj={
        "temperature": 22.5,
        "humidity": 55.2,
        "status": "ok",
        "error": None
    },
    data_group="room_stats"
)
time.sleep(10)