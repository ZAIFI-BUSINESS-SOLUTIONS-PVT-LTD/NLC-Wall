from models import Signature
from typing import List
import threading
import base64
import datetime
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

MAX_SIGNATURES = 500

_store: List[Signature] = []
_lock = threading.Lock()

SIGNATURES_DIR = Path(__file__).parent.parent / "signatures"


def _save_to_disk(sig: Signature) -> None:
    if not sig.signature:
        return
    try:
        # Use the signature's timestamp to determine the date folder
        dt = datetime.datetime.fromtimestamp(sig.timestamp / 1000)
        date_str = dt.strftime("%Y-%m-%d")
        day_dir = SIGNATURES_DIR / date_str
        day_dir.mkdir(parents=True, exist_ok=True)

        header, b64_data = sig.signature.split(",", 1)
        img_bytes = base64.b64decode(b64_data)

        filename = f"{sig.timestamp}_{sig.id[:8]}.png"
        (day_dir / filename).write_bytes(img_bytes)
    except Exception as e:
        logger.error("_save_to_disk failed for sig %s (%s): %s", sig.id, sig.name, e)


def add(sig: Signature) -> None:
    with _lock:
        _store.append(sig)
        if len(_store) > MAX_SIGNATURES:
            _store.pop(0)
    # Save outside the lock to avoid blocking other threads during I/O
    _save_to_disk(sig)


def get_all() -> List[Signature]:
    with _lock:
        return list(_store)


def count() -> int:
    with _lock:
        return len(_store)


def clear() -> None:
    with _lock:
        _store.clear()
