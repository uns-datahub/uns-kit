from gateway.client import Client
import time
# Publish a single data point
client = Client()
client.publish_data(
    topic="sensors/temperature",
    attribute="room1",
    value=22.5,
    uom="°C"
)
time.sleep(10)
