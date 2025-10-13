from gateway.client import Client

def handle_message(msg):
    print(f"Callback got {msg.topic}: {msg.payload}")
    # You could also transform, save, or push to another service

client = Client()
client.subscribe(["sensors/temperature"], callback=handle_message)
