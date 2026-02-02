from __future__ import annotations

import asyncio
import json
import os
import shutil
import importlib.resources
from pathlib import Path
from typing import Optional

import click

from .client import UnsMqttClient
from .packet import UnsPacket
from .topic_builder import TopicBuilder


def common_options(func):
    func = click.option("--host", required=True, help="MQTT host (hostname or host:port)")(func)
    func = click.option("--port", type=int, help="MQTT port override")(func)
    func = click.option("--username", help="MQTT username")(func)
    func = click.option("--password", help="MQTT password")(func)
    func = click.option("--tls/--no-tls", default=False, show_default=True, help="Enable TLS")(func)
    func = click.option("--client-id", help="MQTT clientId")(func)
    func = click.option("--package-name", default="uns-kit", show_default=True, help="Package name for infra topics")(func)
    func = click.option("--package-version", default="0.0.1", show_default=True, help="Package version for infra topics")(func)
    func = click.option("--process-name", default="uns-process", show_default=True, help="Process name for infra topics")(func)
    func = click.option("--reconnect-interval", default=1.0, show_default=True, type=float, help="Reconnect backoff start (s)")(func)
    return func


@click.group(help="Lightweight UNS MQTT helper (Python).")
def cli():
    pass


@cli.command("publish", help="Publish a UNS data packet to a topic.")
@common_options
@click.option("--topic", required=True, help="MQTT topic (e.g. raw/data/)")
@click.option("--value", required=False, help="Value to send (stringified if not JSON).")
@click.option("--uom", default=None, help="Unit of measure.")
@click.option("--json", "json_value", default=None, help="JSON string to use as value.")
@click.option("--qos", type=int, default=0, show_default=True)
@click.option("--retain/--no-retain", default=False, show_default=True)
def publish_cmd(**opts):
    asyncio.run(_run_publish(**opts))


async def _run_publish(
    host: str,
    port: Optional[int],
    username: Optional[str],
    password: Optional[str],
    tls: bool,
    client_id: Optional[str],
    package_name: str,
    package_version: str,
    process_name: str,
    reconnect_interval: float,
    topic: str,
    value: Optional[str],
    uom: Optional[str],
    json_value: Optional[str],
    qos: int,
    retain: bool,
):
    tb = TopicBuilder(package_name, package_version, process_name)
    client = UnsMqttClient(
        host=host.split(":")[0],
        port=int(host.split(":")[1]) if ":" in host and port is None else port,
        username=username,
        password=password,
        tls=tls,
        client_id=client_id,
        topic_builder=tb,
        reconnect_interval=reconnect_interval,
    )
    await client.connect()

    payload_obj = json.loads(json_value) if json_value is not None else value
    packet = UnsPacket.data(value=payload_obj, uom=uom)
    await client.publish_packet(topic, packet, qos=qos, retain=retain)
    await client.close()


@cli.command("subscribe", help="Subscribe to one or more topics (resilient).")
@common_options
@click.option("--topic", "topic_filter", required=True, help="Topic filter (e.g. uns-infra/#)")
def subscribe_cmd(**opts):
    asyncio.run(_run_subscribe(**opts))


async def _run_subscribe(
    host: str,
    port: Optional[int],
    username: Optional[str],
    password: Optional[str],
    tls: bool,
    client_id: Optional[str],
    package_name: str,
    package_version: str,
    process_name: str,
    reconnect_interval: float,
    topic_filter: str,
):
    tb = TopicBuilder(package_name, package_version, process_name)
    client = UnsMqttClient(
        host=host.split(":")[0],
        port=int(host.split(":")[1]) if ":" in host and port is None else port,
        username=username,
        password=password,
        tls=tls,
        client_id=client_id,
        topic_builder=tb,
        reconnect_interval=reconnect_interval,
    )
    await client.connect()

    async for msg in client.resilient_messages(topic_filter):
        try:
            print(f"{msg.topic} {msg.payload.decode()}")
        except Exception:
            print(f"{msg.topic} <binary {len(msg.payload)} bytes>")


@cli.command("create", help="Create a new UNS Python app (default template).")
@click.argument("dest")
def create(dest: str):
    template_root = importlib.resources.files("uns_kit").joinpath("templates/default")
    dest_path = os.path.abspath(dest)
    project_name = Path(dest_path).name
    package_version = "0.0.0"
    if os.path.exists(dest_path):
        raise click.ClickException(f"Destination already exists: {dest_path}")
    shutil.copytree(template_root, dest_path)
    # personalize config with project name
    config_path = Path(dest_path) / "config.json"
    if config_path.exists():
        try:
            data = json.loads(config_path.read_text())
            data.setdefault("uns", {})  # keep structure for processName, etc.
            config_path.write_text(json.dumps(data, indent=2))
        except Exception:
            pass
    # personalize package.json for PM2 metadata
    pkg_path = Path(dest_path) / "package.json"
    if pkg_path.exists():
        try:
            pkg_data = json.loads(pkg_path.read_text())
            pkg_data["name"] = project_name
            pkg_data["version"] = package_version
            pkg_path.write_text(json.dumps(pkg_data, indent=2))
        except Exception:
            pass
    click.echo(f"Created UNS Python app at {dest_path}")
    click.echo("Next steps:")
    click.echo(f"  1) cd {dest_path}")
    click.echo("  2) poetry install")
    click.echo("  3) poetry run python src/main.py")
    click.echo("  4) Edit config.json with your MQTT host/credentials")


@cli.command("write-config", help="Write a minimal config.json scaffold.")
@click.option("--path", default="config.json", show_default=True)
def write_config(path: str):
    project_name = Path(path).resolve().parent.name
    data = {
        "infra": {
            "host": "localhost",
            "port": 1883,
            "username": "",
            "password": "",
            "tls": False,
            "clientId": "uns-py",
            "mqttSubToTopics": [],
            "keepalive": 60,
            "clean": True
        },
        "uns": {
            "processName": "uns-process"
        }
    }
    Path(path).write_text(json.dumps(data, indent=2))
    click.echo(f"Wrote {path}")


def main():
    cli()


if __name__ == "__main__":
    main()
