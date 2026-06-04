from models import Signature
from typing import List
import threading
import base64
import datetime
import logging
from pathlib import Path
import database

logger = logging.getLogger(__name__)

MAX_SIGNATURES = 500

_store: List[Signature] = []
_lock = threading.Lock()

SIGNATURES_DIR = Path(__file__).parent.parent / "signatures"

# Init DB and restore in-memory store from persisted records
database.init_db()
_loaded = database.db_get_all_for_load()
if _loaded:
    _store.extend(_loaded[-MAX_SIGNATURES:])
    logger.info("Loaded %d signatures from database", len(_store))


def _save_to_disk(sig: Signature) -> None:
    if not sig.signature:
        return
    try:
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
    _save_to_disk(sig)
    database.db_add(sig)


def get_all() -> List[Signature]:
    with _lock:
        return list(_store)


def count() -> int:
    with _lock:
        return len(_store)


def count_audience() -> int:
    with _lock:
        return sum(1 for s in _store if not s.is_chief_guest)



def remove(sig_id: str) -> bool:
    """Remove one signature from in-memory store and DB. Returns True if found."""
    with _lock:
        for i, s in enumerate(_store):
            if s.id == sig_id:
                _store.pop(i)
                break
    return database.db_delete(sig_id)


def update_name(sig_id: str, new_name: str) -> bool:
    """Update name in both in-memory store and DB. Returns True if found."""
    with _lock:
        for s in _store:
            if s.id == sig_id:
                s.name = new_name
                break
    return database.db_update_name(sig_id, new_name)


def set_chief_guest(sig_id: str, is_cg: bool) -> bool:
    """Toggle chief-guest flag in memory and DB. Returns True if found."""
    with _lock:
        for s in _store:
            if s.id == sig_id:
                s.is_chief_guest = is_cg
                break
    return database.db_set_chief_guest(sig_id, is_cg)


def clear_audience() -> None:
    """Remove all non-chief-guest signatures from memory and DB."""
    with _lock:
        _store[:] = [s for s in _store if s.is_chief_guest]
    database.db_clear_audience()


def clear_chief_guests() -> None:
    """Remove all chief-guest signatures from memory and DB."""
    with _lock:
        _store[:] = [s for s in _store if not s.is_chief_guest]
    database.db_clear_chief_guests()


def clear() -> None:
    """Remove ALL signatures from memory and DB."""
    with _lock:
        _store.clear()
    database.db_clear()
