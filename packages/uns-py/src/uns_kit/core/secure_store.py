from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional, Protocol


class SecureStore(Protocol):
    def get(self, key: str) -> Optional[str]:
        ...

    def set(self, key: str, value: str) -> None:
        ...

    def delete(self, key: str) -> None:
        ...


class KeyringStore:
    def __init__(self, service: str, keyring_module: object) -> None:
        self.service = service
        self.keyring = keyring_module

    def get(self, key: str) -> Optional[str]:
        value = self.keyring.get_password(self.service, key)
        return value if isinstance(value, str) else None

    def set(self, key: str, value: str) -> None:
        self.keyring.set_password(self.service, key, value)

    def delete(self, key: str) -> None:
        try:
            self.keyring.delete_password(self.service, key)
        except Exception:
            pass


class FileStore:
    def __init__(self, namespace: str, base_dir: Optional[Path] = None) -> None:
        root = (base_dir or self._resolve_base_dir()) / "uns-auth"
        root.mkdir(parents=True, exist_ok=True)
        self.file_path = root / f"{self._sanitize(namespace)}.json"
        if not self.file_path.exists():
            self.file_path.write_text("{}", encoding="utf-8")
        self._chmod(self.file_path, 0o600)

    def get(self, key: str) -> Optional[str]:
        return self._load().get(key)

    def set(self, key: str, value: str) -> None:
        data = self._load()
        data[key] = value
        self._save(data)

    def delete(self, key: str) -> None:
        data = self._load()
        data.pop(key, None)
        self._save(data)

    def _load(self) -> dict[str, str]:
        try:
            raw = self.file_path.read_text(encoding="utf-8")
            parsed = json.loads(raw or "{}")
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}

    def _save(self, data: dict[str, str]) -> None:
        self.file_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        self._chmod(self.file_path, 0o600)

    @staticmethod
    def _resolve_base_dir() -> Path:
        if os.name == "nt":
            return Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming"))
        return Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))

    @staticmethod
    def _sanitize(name: str) -> str:
        return "".join(char if char.isalnum() or char in "._-" else "_" for char in name)

    @staticmethod
    def _chmod(path: Path, mode: int) -> None:
        try:
            path.chmod(mode)
        except Exception:
            pass


class SecureStoreFactory:
    @staticmethod
    def create(namespace: str, *, base_dir: Optional[Path] = None) -> SecureStore:
        try:
            import keyring  # type: ignore

            return KeyringStore(namespace, keyring)
        except Exception:
            return FileStore(namespace, base_dir=base_dir)
