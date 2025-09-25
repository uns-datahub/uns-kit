#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import queue
import time
from typing import Dict
import socket

import grpc

import sys, os
# Ensure generated stubs (python/gen) are importable as top-level modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'gen')))
import uns_gateway_pb2 as pb2
import uns_gateway_pb2_grpc as gw


def make_channel(addr: str) -> grpc.Channel:
    return grpc.insecure_channel(addr)


import atexit, signal, subprocess
_AUTO_GATEWAY_PROC = None
def _cleanup_gateway():
    global _AUTO_GATEWAY_PROC
    if _AUTO_GATEWAY_PROC and _AUTO_GATEWAY_PROC.poll() is None:
        try:
            if os.name == 'nt':
                _AUTO_GATEWAY_PROC.terminate()
            else:
                os.killpg(os.getpgid(_AUTO_GATEWAY_PROC.pid), signal.SIGTERM)
            try:
                _AUTO_GATEWAY_PROC.wait(timeout=3)
            except Exception:
                if os.name == 'nt':
                    _AUTO_GATEWAY_PROC.kill()
                else:
                    os.killpg(os.getpgid(_AUTO_GATEWAY_PROC.pid), signal.SIGKILL)
        except Exception:
            pass
    _AUTO_GATEWAY_PROC = None

def _default_addr() -> str:
    if os.name == 'nt':
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('127.0.0.1', 0))
            port = s.getsockname()[1]
        return f"127.0.0.1:{port}"
    else:
        return f"unix:/tmp/uns-gateway-api-register-and-serve-{os.getpid()}.sock"


def ensure_gateway_running(addr: str | None, *, auto: bool, timeout_s: int = 20) -> str:
    if not addr:
        addr = _default_addr()
    ch = make_channel(addr)
    try:
        grpc.channel_ready_future(ch).result(timeout=2)
        ch.close(); return addr
    except Exception:
        ch.close()
        if not auto:
            return addr
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    cli_path = os.path.join(repo_root, "dist", "uns-grpc", "uns-gateway-cli")
    popen_kwargs = {}
    creationflags = 0
    if os.name != 'nt':
        popen_kwargs['preexec_fn'] = os.setsid
    else:
        creationflags = getattr(subprocess, 'CREATE_NEW_PROCESS_GROUP', 0)
    suffix = f"py-{os.path.basename(__file__).replace('.py','')}-{os.getpid()}"
    proc = subprocess.Popen(["node", cli_path, "--addr", addr, "--instanceSuffix", suffix, "--instanceMode", "force"], cwd=repo_root, creationflags=creationflags, **popen_kwargs)
    global _AUTO_GATEWAY_PROC
    _AUTO_GATEWAY_PROC = proc
    atexit.register(_cleanup_gateway)
    start = time.time()
    while time.time() - start < timeout_s:
        ch2 = make_channel(addr)
        try:
            grpc.channel_ready_future(ch2).result(timeout=2)
            ch2.close();
            try:
                wait_s = int(os.environ.get("UNS_GATEWAY_HANDOVER_WAIT", "11"))
            except Exception:
                wait_s = 11
            if wait_s > 0:
                time.sleep(wait_s)
            return addr
        except Exception:
            ch2.close(); time.sleep(0.5)
    raise RuntimeError("Gateway did not become ready in time")


def register(stub: gw.UnsGatewayStub) -> None:
    qp = [
        pb2.ApiQueryParam(name="filter", type="string", required=True, description="Filter za podatke"),
        pb2.ApiQueryParam(name="limit", type="number", required=False, description="Koliko podatkov želiš"),
    ]
    for idx, tag in [(1, "Tag1"), (2, "Tag2")]:
        res = stub.RegisterApiGet(pb2.RegisterApiGetRequest(
            topic="sij/",
            attribute=f"summary-{idx}",
            api_description=f"Test API endpoint {idx}",
            tags=[tag],
            query_params=qp,
        ))
        if not res.ok:
            raise RuntimeError(f"Register failed: {res.error}")


def serve(stub: gw.UnsGatewayStub, echo: bool) -> None:
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
            if echo:
                q.put(pb2.ApiEventResponse(id=ev.id, status=200, body="OK"))
                continue
            # Build JSON response
            path = ev.path
            query: Dict[str, str] = dict(ev.query)
            body = {
                "status": "OK",
                "endpoint": path,
                "query": query,
            }
            q.put(pb2.ApiEventResponse(id=ev.id, status=200, headers={"Content-Type": "application/json"}, body=json.dumps(body)))
    except KeyboardInterrupt:
        q.put(None)


def main():
    parser = argparse.ArgumentParser(description="Register and serve API endpoints via gateway")
    parser.add_argument("--addr", default=None)
    parser.add_argument("--auto", action="store_true")
    parser.add_argument("--echo", action="store_true")
    args = parser.parse_args()

    addr = ensure_gateway_running(args.addr, auto=args.auto)
    with make_channel(addr) as ch:
        stub = gw.UnsGatewayStub(ch)
        register(stub)
        serve(stub, args.echo)


if __name__ == "__main__":
    main()
