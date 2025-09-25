from __future__ import annotations

import argparse
import asyncio
import os
import time
from typing import Iterable
import subprocess
import socket

import grpc

import sys, os
# Ensure generated stubs (python/gen) are importable as top-level modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'gen')))
import uns_gateway_pb2 as pb2
import uns_gateway_pb2_grpc as gw


def make_channel(addr: str) -> grpc.Channel:
    # addr: e.g. unix:/tmp/xyz.sock or host:port
    if addr.startswith("unix:"):
        return grpc.insecure_channel(addr)
    return grpc.insecure_channel(addr)


import atexit
import signal

AUTO_GATEWAY_PROC = None


def _cleanup_gateway():
    global AUTO_GATEWAY_PROC
    if AUTO_GATEWAY_PROC is None:
        return
    try:
        if AUTO_GATEWAY_PROC.poll() is None:
            if os.name == "nt":
                AUTO_GATEWAY_PROC.terminate()
            else:
                os.killpg(os.getpgid(AUTO_GATEWAY_PROC.pid), signal.SIGTERM)
            try:
                AUTO_GATEWAY_PROC.wait(timeout=3)
            except Exception:
                if os.name == "nt":
                    AUTO_GATEWAY_PROC.kill()
                else:
                    os.killpg(os.getpgid(AUTO_GATEWAY_PROC.pid), signal.SIGKILL)
    except Exception:
        pass
    AUTO_GATEWAY_PROC = None


def _default_addr() -> str:
    if os.name == "nt":
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", 0))
            port = s.getsockname()[1]
        return f"127.0.0.1:{port}"
    else:
        script = os.path.basename(sys.argv[0]).replace(".py", "")
        return f"unix:/tmp/uns-gateway-{script}-{os.getpid()}.sock"


def ensure_gateway_running(addr: str | None, *, auto: bool, timeout_s: int = 20) -> str:
    if not addr:
        addr = _default_addr()
    ch = make_channel(addr)
    try:
        grpc.channel_ready_future(ch).result(timeout=2)
        ch.close()
        return addr
    except Exception:
        ch.close()
        if not auto:
            return addr
    # Try to spawn Node gateway directly (avoid npm wrapping) with fixed address
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    cli_path = os.path.join(repo_root, "dist", "uns-grpc", "uns-gateway-cli")
    creationflags = 0
    popen_kwargs = {}
    if os.name != "nt":
        popen_kwargs["preexec_fn"] = os.setsid  # new process group
    else:
        creationflags = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
    # unique suffix for instances, avoid handover by default in per-script mode
    suffix = f"py-{os.path.basename(sys.argv[0]).replace('.py','')}-{os.getpid()}"
    proc = subprocess.Popen(["node", cli_path, "--addr", addr, "--instanceSuffix", suffix, "--instanceMode", "force"], cwd=repo_root, creationflags=creationflags, **popen_kwargs)
    # remember and register cleanup
    global AUTO_GATEWAY_PROC
    AUTO_GATEWAY_PROC = proc
    atexit.register(_cleanup_gateway)

    # Wait until channel is ready
    start = time.time()
    while time.time() - start < timeout_s:
        ch2 = make_channel(addr)
        try:
            grpc.channel_ready_future(ch2).result(timeout=2)
            ch2.close()
            # Optional handover wait for active publisher/subscriber (default 11s)
            try:
                wait_s = int(os.environ.get("UNS_GATEWAY_HANDOVER_WAIT", "11"))
            except Exception:
                wait_s = 11
            if wait_s > 0:
                time.sleep(wait_s)
            return addr
        except Exception:
            ch2.close()
            time.sleep(0.5)
    raise RuntimeError("Gateway did not become ready in time")


def publish_data(addr: str, *, topic: str, attribute: str, time_iso: str, value_number: float, uom: str = "", data_group: str = "", value_is_cumulative: bool = False):
    with make_channel(addr) as ch:
        stub = gw.UnsGatewayStub(ch)
        req = pb2.PublishRequest(
            topic=topic,
            attribute=attribute,
            data=pb2.Data(time=time_iso, value_number=value_number, uom=uom, data_group=data_group),
            value_is_cumulative=value_is_cumulative,
        )
        res = stub.Publish(req)
        if not res.ok:
            raise RuntimeError(res.error)


def subscribe(addr: str, topics: Iterable[str]):
    with make_channel(addr) as ch:
        stub = gw.UnsGatewayStub(ch)
        # Ensure subscriber readiness if gateway supports it
        try:
            stub.Ready(pb2.ReadyRequest(timeout_ms=15000, wait_input=True))
        except Exception:
            pass
        stream = stub.Subscribe(pb2.SubscribeRequest(topics=list(topics)))
        try:
            for msg in stream:
                print(f"{msg.topic}: {msg.payload}")
        except KeyboardInterrupt:
            pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--addr", default=None, help="Gateway address, e.g. unix:/tmp/uns-gateway.sock or 127.0.0.1:50051 (defaults to unique per-script)")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_pub = sub.add_parser("pub")
    p_pub.add_argument("topic")
    p_pub.add_argument("attribute")
    p_pub.add_argument("time_iso")
    p_pub.add_argument("value", type=float)
    p_pub.add_argument("--uom", default="")
    p_pub.add_argument("--group", default="")
    p_pub.add_argument("--cumulative", action="store_true")
    p_pub.add_argument("--auto", action="store_true", help="auto start gateway if not running")

    p_sub = sub.add_parser("sub")
    p_sub.add_argument("topics", nargs="+")
    p_sub.add_argument("--auto", action="store_true", help="auto start gateway if not running")

    p_reg = sub.add_parser("regapi")
    p_reg.add_argument("topic")
    p_reg.add_argument("attribute")
    p_reg.add_argument("--desc", default="")
    p_reg.add_argument("--tag", action="append", default=[])
    p_reg.add_argument("--param", action="append", default=[], help="query param as name:type:required:desc (e.g., filter:string:true:Filter za podatke)")
    p_reg.add_argument("--auto", action="store_true", help="auto start gateway if not running")

    p_unreg = sub.add_parser("unregapi")
    p_unreg.add_argument("topic")
    p_unreg.add_argument("attribute")
    p_unreg.add_argument("--auto", action="store_true", help="auto start gateway if not running")

    p_stream = sub.add_parser("apistream")
    p_stream.add_argument("--echo", action="store_true", help="auto 200 OK echo response")
    p_stream.add_argument("--auto", action="store_true", help="auto start gateway if not running")

    args = parser.parse_args()
    if args.cmd == "pub":
        addr = ensure_gateway_running(args.addr, auto=args.auto)
        # Ensure publisher readiness
        try:
            with make_channel(addr) as ch:
                gw.UnsGatewayStub(ch).Ready(pb2.ReadyRequest(timeout_ms=15000, wait_output=True))
        except Exception:
            pass
        publish_data(addr, topic=args.topic, attribute=args.attribute, time_iso=args.time_iso, value_number=args.value, uom=args.uom, data_group=args.group, value_is_cumulative=args.cumulative)
    elif args.cmd == "sub":
        addr = ensure_gateway_running(args.addr, auto=args.auto)
        subscribe(addr, args.topics)
    elif args.cmd == "regapi":
        addr = ensure_gateway_running(args.addr, auto=args.auto)
        with make_channel(addr) as ch:
            stub = gw.UnsGatewayStub(ch)
            params = []
            for s in args.param:
                try:
                    name, typ, req, desc = s.split(":", 3)
                except ValueError:
                    name, typ = s.split(":", 1)
                    req, desc = "false", ""
                params.append(pb2.ApiQueryParam(name=name, type=typ, required=(req.lower() in ("true","1")), description=desc))
            req = pb2.RegisterApiGetRequest(topic=args.topic, attribute=args.attribute, api_description=args.desc, tags=args.tag, query_params=params)
            res = stub.RegisterApiGet(req)
            print("registered" if res.ok else f"error: {res.error}")
    elif args.cmd == "unregapi":
        addr = ensure_gateway_running(args.addr, auto=args.auto)
        with make_channel(addr) as ch:
            stub = gw.UnsGatewayStub(ch)
            res = stub.UnregisterApiGet(pb2.UnregisterApiGetRequest(topic=args.topic, attribute=args.attribute))
            print("unregistered" if res.ok else f"error: {res.error}")
    elif args.cmd == "apistream":
        addr = ensure_gateway_running(args.addr, auto=args.auto)
        import queue
        import threading
        with make_channel(addr) as ch:
            stub = gw.UnsGatewayStub(ch)
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
                    print(f"API {ev.method} {ev.path} query={dict(ev.query)}")
                    if args.echo:
                        q.put(pb2.ApiEventResponse(id=ev.id, status=200, body="OK"))
            except KeyboardInterrupt:
                q.put(None)


if __name__ == "__main__":
    main()
