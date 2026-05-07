from models import Signature
from typing import List
import threading

MAX_SIGNATURES = 500

_store: List[Signature] = []
_lock = threading.Lock()


def add(sig: Signature) -> None:
    with _lock:
        _store.append(sig)
        if len(_store) > MAX_SIGNATURES:
            _store.pop(0)


def get_all() -> List[Signature]:
    with _lock:
        return list(_store)


def count() -> int:
    with _lock:
        return len(_store)


def clear() -> None:
    with _lock:
        _store.clear()
