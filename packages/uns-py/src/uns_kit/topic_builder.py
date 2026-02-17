from __future__ import annotations

import json
import re
from pathlib import Path

from .version import __package_name__, __version__

LIBRARY_PACKAGE_NAME = __package_name__


def resolve_runtime_package_metadata(start_path: Path | None = None) -> tuple[str | None, str | None]:
    current = (start_path or Path.cwd()).resolve()
    search_dirs = [current] + list(current.parents)
    for directory in search_dirs:
        package_json = directory / "package.json"
        if not package_json.exists():
            continue
        try:
            payload = json.loads(package_json.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(payload, dict):
            continue
        name = payload.get("name")
        version = payload.get("version")
        resolved_name = str(name) if isinstance(name, str) and name.strip() else None
        resolved_version = str(version) if isinstance(version, str) and version.strip() else None
        return resolved_name, resolved_version
    return None, None


class TopicBuilder:
    """
    Mirrors the TypeScript MqttTopicBuilder for infra topics.
    """

    def __init__(
        self,
        package_name: str | None = None,
        package_version: str | None = None,
        process_name: str | None = None,
    ):
        # Backward compatible constructor:
        # - TopicBuilder("pkg", "ver", "proc")  -> old style
        # - TopicBuilder("proc")                -> process-only style
        if process_name is None and package_version is None and package_name is not None:
            process_name = package_name
            package_name = None

        detected_package_name, detected_package_version = resolve_runtime_package_metadata()
        resolved_package_name = package_name or detected_package_name or LIBRARY_PACKAGE_NAME
        resolved_package_version = package_version or detected_package_version or __version__
        resolved_process_name = process_name or "uns-process"

        self.package_name = self.sanitize_topic_part(resolved_package_name)
        self.package_version = self.sanitize_topic_part(resolved_package_version)
        self.process_name = self.sanitize_topic_part(resolved_process_name)
        self._base = f"uns-infra/{self.package_name}/{self.package_version}/{self.process_name}/"
        if not re.match(r"^uns-infra/[^/]+/[^/]+/[^/]+/$", self._base):
            raise ValueError("processStatusTopic must follow 'uns-infra/<package>/<version>/<process>/'")

    @staticmethod
    def sanitize_topic_part(name: str) -> str:
        sanitized = re.sub(r"[^a-zA-Z0-9_-]+", "-", name)
        sanitized = re.sub(r"-{2,}", "-", sanitized)
        sanitized = sanitized.strip("-")
        return sanitized or "uns-process"

    @property
    def process_status_topic(self) -> str:
        return self._base

    def active_topic(self) -> str:
        return f"{self._base}active"

    def handover_topic(self) -> str:
        return f"{self._base}handover"

    def wildcard_active_topic(self) -> str:
        parts = self._base.strip("/").split("/")
        if len(parts) < 2:
            raise ValueError("processStatusTopic must follow 'uns-infra/<package>/<version>/<process>/'")
        return "/".join(parts[:2]) + "/+/+/active"

    def instance_status_topic(self, instance_name: str) -> str:
        sanitized = self.sanitize_topic_part(instance_name)
        return f"{self._base}{sanitized}/"

    @staticmethod
    def extract_base_topic(full_topic: str) -> str:
        parts = full_topic.split("/")
        if len(parts) < 4:
            raise ValueError("Invalid topic format. Expected 'uns-infra/<package>/<version>/<process>/'.")
        return "/".join(parts[:4]) + "/"
