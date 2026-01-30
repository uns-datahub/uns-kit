from __future__ import annotations

import re


class TopicBuilder:
    """
    Mirrors the TypeScript MqttTopicBuilder for infra topics.
    """

    def __init__(self, package_name: str, package_version: str, process_name: str):
        self.package_name = self.sanitize_topic_part(package_name)
        self.package_version = self.sanitize_topic_part(package_version)
        self.process_name = self.sanitize_topic_part(process_name)
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
