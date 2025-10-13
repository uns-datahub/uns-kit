from gateway.client import Client, iso_now
import json

client = Client()
    
def transform_data(value):
    
    return value * 1.1

def handle_message(msg):
    payload = json.loads(msg.payload)
    value = float(payload["value"])
    
    transformed_value = transform_data(value)
    client.publish_data("sensors/temperature", "room1", value=transformed_value, uom="°C")

client.subscribe(["sensors/temperature"], callback=handle_message)
