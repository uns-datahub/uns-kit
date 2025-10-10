from gateway.client import Client
from uns_gateway_pb2 import ApiQueryParam, ApiEventResponse
import json

client = Client()

# Register API with structured query params
qp = [
    ApiQueryParam(name="filter", type="string", required=True, description="Filter za podatke"),
    ApiQueryParam(name="limit", type="number", required=False, description="Koliko podatkov želiš"),
]

client.register_api(
    topic="example/",
    attribute="summary-1",
    desc="Example API endpoint",
    tags=["example", "demo"],
    query_params=qp
)

# Handle API events
def handle_api(ev):
    print(f"API request: {ev.path}, query={dict(ev.query)}")
    body = {"status": "OK", "path": ev.path, "query": dict(ev.query)}
    return ApiEventResponse(id=ev.id, status=200, headers={"Content-Type": "application/json"},
                            body=json.dumps(body))

client.api_stream(handle_event=handle_api)
