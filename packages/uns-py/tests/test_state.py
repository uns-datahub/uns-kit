from __future__ import annotations

import threading

from uns_kit import State
from uns_kit.core import State as CoreState


def setup_function() -> None:
    State().clear()


def teardown_function() -> None:
    State().clear()


def test_state_is_a_shared_singleton_and_publicly_exported() -> None:
    assert State is CoreState
    assert State() is State()


def test_state_stores_reads_and_removes_values() -> None:
    state = State()
    state.set("mark_machine", {"plateID": "P123"})

    assert state.get("mark_machine") == {"plateID": "P123"}
    assert state.get("missing", "fallback") == "fallback"
    assert state.pop("mark_machine") == {"plateID": "P123"}
    assert state.pop("mark_machine", "fallback") == "fallback"


def test_state_clear_and_snapshot_do_not_expose_its_dictionary() -> None:
    state = State()
    state.set("cycle_run", True)
    snapshot = state.snapshot()
    snapshot["cycle_run"] = False

    assert state.get("cycle_run") is True
    state.clear()
    assert state.snapshot() == {}


def test_state_operations_are_thread_safe() -> None:
    state = State()

    def write(index: int) -> None:
        state.set(f"key-{index}", index)

    threads = [threading.Thread(target=write, args=(index,)) for index in range(32)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert state.snapshot() == {f"key-{index}": index for index in range(32)}
