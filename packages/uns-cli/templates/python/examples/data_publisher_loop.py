#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import time
from datetime import datetime, timezone
import socket

import grpc

import sys, os
# Ensure generated stubs (python/gen) are importable as top-level modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'gen')))
import uns_gateway_pb2 as pb2
import uns_gateway_pb2_grpc as gw


def iso_now() -> str:
    dt = datetime.now(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


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
        return f"unix:/tmp/uns-gateway-data-publisher-loop-{os.getpid()}.sock"


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


def loop_publish(addr: str | None, out_topic: str, attribute: str, uom: str, period_ms: int, auto: bool) -> None:
    addr = ensure_gateway_running(addr, auto=auto)
    # Ensure publisher readiness via gRPC
    try:
        with make_channel(addr) as ch:
            gw.UnsGatewayStub(ch).Ready(pb2.ReadyRequest(timeout_ms=15000, wait_output=True))
    except Exception:
        pass
    with make_channel(addr) as ch:
        stub = gw.UnsGatewayStub(ch)
        i = 0
        try:
            while True:
                i += 1
                req = pb2.PublishRequest(
                    topic=out_topic,
                    attribute=attribute,
                    data=pb2.Data(time=iso_now(), value_number=float(i % 100), uom=uom),
                )
                res = stub.Publish(req)
                if not res.ok:
                    print("publish error:", res.error)
                time.sleep(max(0.0, period_ms / 1000.0))
        except KeyboardInterrupt:
            pass


def main():
    parser = argparse.ArgumentParser(description="Publish UNS data packets periodically (cron-like)")
    parser.add_argument("--addr", default=None)
    parser.add_argument("--auto", action="store_true")
    parser.add_argument("--out-topic", default="example/")
    parser.add_argument("--attribute", default="data-number")
    parser.add_argument("--uom", default="mV")
    parser.add_argument("--period-ms", type=int, default=1000)
    args = parser.parse_args()

    loop_publish(args.addr, args.out_topic, args.attribute, args.uom, args.period_ms, args.auto)


if __name__ == "__main__":
    main()
