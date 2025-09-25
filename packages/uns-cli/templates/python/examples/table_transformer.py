#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import time
from datetime import datetime, timezone
from typing import Iterable, Dict
import socket

import grpc

import sys, os
# Ensure generated stubs (python/gen) are importable as top-level modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'gen')))
import uns_gateway_pb2 as pb2
import uns_gateway_pb2_grpc as gw


def iso_from_epoch_ms(ms: int) -> str:
    dt = datetime.fromtimestamp(ms / 1000.0, tz=timezone.utc)
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
        return f"unix:/tmp/uns-gateway-table-transformer-{os.getpid()}.sock"


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


def transform(addr: str | None, in_topic: str, out_topic: str, out_attribute: str, auto: bool) -> None:
    addr = ensure_gateway_running(addr, auto=auto)
    # Ensure both subscriber and publisher are ready
    try:
        with make_channel(addr) as ch:
            gw.UnsGatewayStub(ch).Ready(pb2.ReadyRequest(timeout_ms=15000, wait_input=True, wait_output=True))
    except Exception:
        pass
    with make_channel(addr) as ch:
        stub = gw.UnsGatewayStub(ch)
        stream = stub.Subscribe(pb2.SubscribeRequest(topics=[in_topic]))
        for msg in stream:
            if msg.topic != in_topic:
                continue
            try:
                obj = json.loads(msg.payload)
            except Exception:
                continue
            ts = obj.pop("Timestamp", None)
            if ts is None:
                continue
            try:
                ts_ms = int(ts)
            except Exception:
                continue
            time_iso = iso_from_epoch_ms(ts_ms if ts_ms > 10_000_000_000 else ts_ms * 1000)

            values: Dict[str, pb2.TableValue] = {}
            tv_list = []
            for k, v in obj.items():
                if isinstance(v, (int, float)):
                    tv_list.append(pb2.TableValue(key=k, value_number=float(v)))
                elif v is None:
                    tv_list.append(pb2.TableValue(key=k))
                else:
                    tv_list.append(pb2.TableValue(key=k, value_string=str(v)))

            req = pb2.PublishRequest(
                topic=out_topic,
                attribute=out_attribute,
                table=pb2.Table(time=time_iso, values=tv_list, data_group="iba_test"),
            )
            res = stub.Publish(req)
            if not res.ok:
                print("publish error:", res.error)


def main():
    parser = argparse.ArgumentParser(description="Subscribe to IBA topic and publish UNS table packets")
    parser.add_argument("--addr", default=None, help="Gateway address (unix:/path.sock or host:port); defaults to unique per-script")
    parser.add_argument("--auto", action="store_true", help="auto-start gateway if not running")
    parser.add_argument("--in-topic", default="iba/zrm")
    parser.add_argument("--out-topic", default="sij/acroni/hv/")
    parser.add_argument("--attribute", default="zrm")
    args = parser.parse_args()

    transform(args.addr, args.in_topic, args.out_topic, args.attribute, args.auto)


if __name__ == "__main__":
    main()
