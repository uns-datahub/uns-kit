from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

from .topic_builder import TopicBuilder


@dataclass
class UnsConfig:
    host: str
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    client_id: Optional[str] = None
    tls: bool = False
    keepalive: int = 60
    clean_session: bool = True
    mqtt_sub_to_topics: Optional[List[str]] = None
    package_name: str = "uns-kit"
    package_version: str = "0.0.1"
    process_name: str = "uns-process"

    @staticmethod
    def load(path: Path) -> "UnsConfig":
        data = json.loads(path.read_text())
        return UnsConfig(**data)

    def topic_builder(self) -> TopicBuilder:
        return TopicBuilder(self.package_name, self.package_version, self.process_name)
