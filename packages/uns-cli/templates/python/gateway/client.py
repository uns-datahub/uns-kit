from typing import Iterable, Dict, Callable, List
import queue
import json
import threading
from datetime import datetime, timezone
import grpc
from .manager import GatewayManager

from gen import uns_gateway_pb2 as pb2
from gen import uns_gateway_pb2_grpc as gw


def iso_now() -> str:
    """Return current UTC time in ISO format with milliseconds."""
    dt = datetime.now(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def make_channel(addr: str) -> grpc.Channel:
    """Create a gRPC insecure channel."""
    return grpc.insecure_channel(addr)


class Client:
    """
    High-level client for UNS gateway.
    Automatically manages gateway lifecycle and keeps a persistent stub.
    """

    def __init__(self, addr: str | None = None, auto: bool = True, timeout_s: int = 20):
        self.manager = GatewayManager(addr=addr, auto=auto, timeout_s=timeout_s)
        self.addr = self.manager.ensure_running()
        self._ch = make_channel(self.addr)
        self._stub = gw.UnsGatewayStub(self._ch)

    # --- Publish ---
    def publish_data(self, topic: str, attribute: str, value: float,
                     time_iso: str | None = None, uom: str = "",
                     data_group: str = "", cumulative: bool = False):
        time_iso = time_iso or iso_now()
        req = pb2.PublishRequest(
            topic=topic,
            attribute=attribute,
            data=pb2.Data(
                time=time_iso,
                value_number=value,
                uom=uom,
                data_group=data_group
            ),
            value_is_cumulative=cumulative
        )
        res = self._stub.Publish(req)
        if not res.ok:
            raise RuntimeError(res.error)
        
    def publish_table(self, topic: str, attribute: str, obj: Dict[str, any],
                      time_iso: str | None = None, data_group: str = "default"):
        """
        Publish a dictionary as a Table.
        Numeric values -> value_number
        None -> empty
        Other -> value_string
        """
        time_iso = time_iso or iso_now()
        tv_list = []
        for k, v in obj.items():
            if isinstance(v, (int, float)):
                tv_list.append(pb2.TableValue(key=k, value_number=float(v)))
            elif v is None:
                tv_list.append(pb2.TableValue(key=k))
            else:
                tv_list.append(pb2.TableValue(key=k, value_string=str(v)))

        req = pb2.PublishRequest(
            topic=topic,
            attribute=attribute,
            table=pb2.Table(time=time_iso, values=tv_list, data_group=data_group)
        )
        res = self._stub.Publish(req)
        if not res.ok:
            raise RuntimeError(res.error)
    # --- Subscribe ---
    def subscribe(self, topics: Iterable[str], callback: Callable[[any], None] | None = None):
        """
        Subscribe to topics and call the provided callback on each message.
        """
        stub = self._stub
        try:
            stub.Ready(pb2.ReadyRequest(timeout_ms=15000, wait_input=True))
        except Exception:
            pass

        stream = stub.Subscribe(pb2.SubscribeRequest(topics=list(topics)))
        try:
            for msg in stream:
                if callback:
                    callback(msg)
                else:
                    print(f"{msg.topic}: {msg.payload}")
        except KeyboardInterrupt:
            pass

    # --- API Register ---
    def register_api(self, topic: str, attribute: str, desc: str = "",
                     tags: list[str] | None = None,
                     query_params: List[pb2.ApiQueryParam] | None = None):
        tags = tags or []
        query_params = query_params or []

        res = self._stub.RegisterApiGet(
            pb2.RegisterApiGetRequest(
                topic=topic,
                attribute=attribute,
                api_description=desc,
                tags=tags,
                query_params=query_params
            )
        )
        if not res.ok:
            raise RuntimeError(f"Register failed: {res.error}")

    def unregister_api(self, topic: str, attribute: str):
        res = self._stub.UnregisterApiGet(
            pb2.UnregisterApiGetRequest(topic=topic, attribute=attribute)
        )
        if not res.ok:
            raise RuntimeError(f"Unregister failed: {res.error}")

    # --- API Stream ---
    def api_stream(self, echo: bool = False, handle_event: Callable | None = None):
        q: "queue.Queue[pb2.ApiEventResponse|None]" = queue.Queue()

        def req_iter():
            while True:
                item = q.get()
                if item is None:
                    break
                yield item

        stream = self._stub.ApiEventStream(req_iter())
        try:
            for ev in stream:
                if handle_event:
                    resp = handle_event(ev)
                    if resp:
                        q.put(resp)
                    continue
                if echo:
                    q.put(pb2.ApiEventResponse(id=ev.id, status=200, body="OK"))
                    continue
                body = {"status": "OK", "endpoint": ev.path, "query": dict(ev.query)}
                q.put(pb2.ApiEventResponse(id=ev.id, status=200, headers={"Content-Type": "application/json"},
                                           body=json.dumps(body)))
        except KeyboardInterrupt:
            q.put(None)
