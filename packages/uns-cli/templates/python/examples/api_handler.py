#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import queue
from typing import Dict, Iterable, Optional

import grpc

import sys, os
# Ensure generated stubs (python/gen) are importable as top-level modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'gen')))
import uns_gateway_pb2 as pb2
import uns_gateway_pb2_grpc as gw


def make_channel(addr: str) -> grpc.Channel:
    # Supports unix:/path.sock or host:port
    return grpc.insecure_channel(addr)


def register_endpoints(stub: gw.UnsGatewayStub) -> None:
    # Mirror TS api-example.ts for two GET endpoints under /api/sij/summary-1 and -2
    qp = [
        pb2.ApiQueryParam(name="filter", type="string", required=True, description="Filter za podatke"),
        pb2.ApiQueryParam(name="limit", type="number", required=False, description="Koliko podatkov želiš"),
    ]

    for idx, tag in [(1, "Tag1"), (2, "Tag2")]:
        req = pb2.RegisterApiGetRequest(
            topic="sij/",
            attribute=f"summary-{idx}",
            api_description=f"Test API endpoint {idx}",
            tags=[tag],
            query_params=qp,
        )
        res = stub.RegisterApiGet(req)
        if not res.ok:
            raise RuntimeError(f"Failed to register summary-{idx}: {res.error}")


def serve_requests(stub: gw.UnsGatewayStub, echo: bool = False) -> None:
    q: "queue.Queue[pb2.ApiEventResponse|None]" = queue.Queue()

    def req_iter():
        while True:
            item = q.get()
            if item is None:
                break
            yield item

    stream = stub.ApiEventStream(req_iter())
    try:
        for ev in stream:
            # ev.path e.g. /sij/summary-1; ev.query is a map<string,string>
            path = ev.path
            query: Dict[str, str] = dict(ev.query)
            filt = query.get("filter", "")
            limit = query.get("limit")
            endpoint = "summary-1" if path.endswith("summary-1") else ("summary-2" if path.endswith("summary-2") else "unknown")

            # Your business logic here. This example returns JSON reflecting the request.
            body = {
                "status": "OK",
                "endpoint": endpoint,
                "filter": filt,
                "limit": int(limit) if (limit is not None and limit.isdigit()) else None,
                "data": [
                    {"id": 1, "value": 42},
                    {"id": 2, "value": 43},
                ],
            }

            q.put(
                pb2.ApiEventResponse(
                    id=ev.id,
                    status=200,
                    headers={"Content-Type": "application/json"},
                    body=json.dumps(body),
                )
            )
    except KeyboardInterrupt:
        q.put(None)


def main():
    parser = argparse.ArgumentParser(description="Python API handler for UNS gRPC Gateway")
    parser.add_argument("--addr", default=os.environ.get("GATEWAY_ADDR", "unix:/tmp/template-uns-rtt-1.6.14-uns-gateway.sock"), help="Gateway address (unix:/path.sock or host:port)")
    parser.add_argument("--echo", action="store_true", help="Echo simple OK response instead of JSON body")
    args = parser.parse_args()

    with make_channel(args.addr) as ch:
        stub = gw.UnsGatewayStub(ch)
        register_endpoints(stub)
        serve_requests(stub, echo=args.echo)


if __name__ == "__main__":
    main()
