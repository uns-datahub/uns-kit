#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import time
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
        return f"unix:/tmp/uns-gateway-data-subscribe-{os.getpid()}.sock"


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


def subscribe(addr: str | None, topics: list[str], auto: bool) -> None:
    addr = ensure_gateway_running(addr, auto=auto)
    # Ensure subscriber readiness
    try:
        with make_channel(addr) as ch:
            gw.UnsGatewayStub(ch).Ready(pb2.ReadyRequest(timeout_ms=15000, wait_input=True))
    except Exception:
        pass
    with make_channel(addr) as ch:
        stub = gw.UnsGatewayStub(ch)
        stream = stub.Subscribe(pb2.SubscribeRequest(topics=topics))
        try:
            for msg in stream:
                print(f"{msg.topic}: {msg.payload}")
        except KeyboardInterrupt:
            pass


def main():
    parser = argparse.ArgumentParser(description="Subscribe to MQTT topics via gateway")
    parser.add_argument("--addr", default=None)
    parser.add_argument("--auto", action="store_true")
    parser.add_argument("topics", nargs="+")
    args = parser.parse_args()

    subscribe(args.addr, args.topics, args.auto)


if __name__ == "__main__":
    main()
