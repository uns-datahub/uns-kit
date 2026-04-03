import argparse
from .manager import GatewayManager
from . import client
import uns_gateway_pb2_grpc as gw
from .client import make_channel

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--addr", default=None)
    sub = parser.add_subparsers(dest="cmd", required=True)

    # --- Publish ---
    p_pub = sub.add_parser("pub")
    p_pub.add_argument("topic")
    p_pub.add_argument("attribute")
    p_pub.add_argument("time_iso")
    p_pub.add_argument("value", type=float)
    p_pub.add_argument("--uom", default="")
    p_pub.add_argument("--group", default="")
    p_pub.add_argument("--cumulative", action="store_true")
    p_pub.add_argument("--auto", action="store_true")

    # --- Subscribe ---
    p_sub = sub.add_parser("sub")
    p_sub.add_argument("topics", nargs="+")
    p_sub.add_argument("--auto", action="store_true")

    # --- Register API ---
    p_reg = sub.add_parser("regapi")
    p_reg.add_argument("topic")
    p_reg.add_argument("attribute")
    p_reg.add_argument("--desc", default="")
    p_reg.add_argument("--tag", action="append", default=[])
    p_reg.add_argument("--param", action="append", default=[])
    p_reg.add_argument("--auto", action="store_true")

    # --- Unregister API ---
    p_unreg = sub.add_parser("unregapi")
    p_unreg.add_argument("topic")
    p_unreg.add_argument("attribute")
    p_unreg.add_argument("--auto", action="store_true")

    # --- API Stream ---
    p_stream = sub.add_parser("apistream")
    p_stream.add_argument("--echo", action="store_true")
    p_stream.add_argument("--auto", action="store_true")

    args = parser.parse_args()
    mgr = GatewayManager(args.addr, auto=getattr(args, "auto", False))
    addr = mgr.ensure_running()

    if args.cmd == "pub":
        client.publish_data(
            addr, topic=args.topic, attribute=args.attribute,
            time_iso=args.time_iso, value_number=args.value,
            uom=args.uom, data_group=args.group,
            value_is_cumulative=args.cumulative
        )
    elif args.cmd == "sub":
        client.subscribe(addr, args.topics)
    elif args.cmd == "regapi":
        with make_channel(addr) as ch:
            stub = gw.UnsGatewayStub(ch)
            client.register_api(stub, args.topic, args.attribute, args.desc, args.tag, args.param)
            print("registered")
    elif args.cmd == "unregapi":
        with make_channel(addr) as ch:
            stub = gw.UnsGatewayStub(ch)
            client.unregister_api(stub, args.topic, args.attribute)
            print("unregistered")
    elif args.cmd == "apistream":
        client.api_stream(addr, echo=args.echo)

if __name__ == "__main__":
    main()
