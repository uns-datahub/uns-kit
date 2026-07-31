"""Thread-safe, process-local application state."""

from __future__ import annotations

import threading
from typing import Any


class State:
    """A shared in-memory key/value store for one Python process.

    Every ``State()`` call returns the same object. State is intentionally not
    persisted and is therefore cleared whenever the process restarts.
    """

    _instance: "State | None" = None
    _instance_lock = threading.Lock()
    _values: dict[str, Any]
    _lock: threading.RLock

    def __new__(cls) -> "State":
        with cls._instance_lock:
            if cls._instance is None:
                instance = super().__new__(cls)
                instance._values = {}
                instance._lock = threading.RLock()
                cls._instance = instance
            return cls._instance

    def set(self, key: str, value: Any) -> None:
        """Store ``value`` under ``key``."""
        with self._lock:
            self._values[key] = value

    def get(self, key: str, default: Any = None) -> Any:
        """Return the value for ``key``, or ``default`` when it is absent."""
        with self._lock:
            return self._values.get(key, default)

    def pop(self, key: str, default: Any = None) -> Any:
        """Remove and return the value for ``key``, or ``default`` when absent."""
        with self._lock:
            return self._values.pop(key, default)

    def clear(self) -> None:
        """Remove every stored value."""
        with self._lock:
            self._values.clear()

    def snapshot(self) -> dict[str, Any]:
        """Return a shallow copy of the current state."""
        with self._lock:
            return dict(self._values)
