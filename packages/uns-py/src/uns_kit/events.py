from __future__ import annotations

import inspect
from collections import defaultdict
from typing import Any, Awaitable, Callable, DefaultDict


EventHandler = Callable[[Any], Any | Awaitable[Any]]


class EventEmitter:
    def __init__(self) -> None:
        self._handlers: DefaultDict[str, list[EventHandler]] = defaultdict(list)

    def on(self, event_name: str, handler: EventHandler) -> EventHandler:
        self._handlers[event_name].append(handler)
        return handler

    async def emit(self, event_name: str, payload: Any) -> None:
        for handler in list(self._handlers.get(event_name, [])):
            result = handler(payload)
            if inspect.isawaitable(result):
                await result
