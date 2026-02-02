from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple

from .topic_builder import TopicBuilder
from .version import __version__


@dataclass
class UnsConfig:
    # MQTT infra (matches TS nested config.infra)
    infra_host: str
    infra_port: Optional[int] = None
    infra_username: Optional[str] = None
    infra_password: Optional[str] = None
    infra_client_id: Optional[str] = None
    infra_tls: bool = False
    keepalive: int = 60
    clean_session: bool = True
    mqtt_sub_to_topics: Optional[List[str]] = None
    package_name: str = "uns-kit"
    package_version: str = __version__
    process_name: str = "uns-process"

    @staticmethod
    def load(path: Path) -> "UnsConfig":
        data = json.loads(path.read_text())

        if "infra" not in data or "uns" not in data:
            raise ValueError("config.json must include 'infra' and 'uns' sections (TS-style config)")

        infra = data.get("infra", {}) or {}
        uns_section = data.get("uns", {}) or {}
        pkg_name, pkg_version = _read_package_metadata(path)

        proto = (infra.get("protocol") or "").lower()
        tls = proto in ("mqtts", "ssl", "wss")

        host = infra.get("host") or (infra.get("hosts") or [None])[0]
        if not host:
            raise ValueError("infra.host (or hosts[0]) is required")

        return UnsConfig(
            infra_host=host,
            infra_port=infra.get("port"),
            infra_username=_none_if_empty(infra.get("username")),
            infra_password=_none_if_empty(infra.get("password")),
            infra_client_id=_none_if_empty(infra.get("clientId")),
            infra_tls=infra.get("tls") if infra.get("tls") is not None else tls,
            mqtt_sub_to_topics=infra.get("mqttSubToTopics"),
            keepalive=infra.get("keepalive", 60),
            clean_session=infra.get("clean", True),
            package_name=uns_section.get("packageName") or pkg_name or "uns-kit",
            package_version=uns_section.get("packageVersion") or pkg_version or __version__,
            process_name=uns_section.get("processName", "uns-process"),
        )

    def topic_builder(self) -> TopicBuilder:
        return TopicBuilder(self.package_name, self.package_version, self.process_name)

    # Convenience accessors for MQTT client creation
    @property
    def host(self) -> str:
        return self.infra_host

    @property
    def port(self) -> Optional[int]:
        return self.infra_port

    @property
    def username(self) -> Optional[str]:
        return self.infra_username

    @property
    def password(self) -> Optional[str]:
        return self.infra_password

    @property
    def client_id(self) -> Optional[str]:
        return self.infra_client_id

    @property
    def tls(self) -> bool:
        return self.infra_tls


def _none_if_empty(value: Optional[str]) -> Optional[str]:
    return None if value == "" else value


def _read_package_metadata(config_path: Path) -> Tuple[Optional[str], Optional[str]]:
    """
    Read name/version from the nearest package.json beside the config (if present).
    Falls back to None when not available or invalid.
    """
    pkg_path = config_path.parent / "package.json"
    if not pkg_path.exists():
        return None, None
    try:
        pkg = json.loads(pkg_path.read_text())
        name = pkg.get("name")
        version = pkg.get("version")
        return (name if isinstance(name, str) else None, version if isinstance(version, str) else None)
    except Exception:
        return None, None
