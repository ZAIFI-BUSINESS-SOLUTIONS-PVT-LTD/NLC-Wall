import sqlite3
import threading
from pathlib import Path
from typing import List, Optional

from models import Signature

DB_PATH = Path(__file__).parent.parent / "signwall.db"

_lock = threading.Lock()


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _lock:
        conn = _get_conn()
        try:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS signatures (
                    id             TEXT PRIMARY KEY,
                    name           TEXT NOT NULL,
                    signature      TEXT,
                    timestamp      INTEGER NOT NULL,
                    is_chief_guest INTEGER DEFAULT 0
                )
            """)
            cols = [row[1] for row in conn.execute("PRAGMA table_info(signatures)").fetchall()]
            if "is_chief_guest" not in cols:
                conn.execute("ALTER TABLE signatures ADD COLUMN is_chief_guest INTEGER DEFAULT 0")

            conn.execute("""
                CREATE TABLE IF NOT EXISTS config (
                    key   TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
            """)
            conn.commit()
        finally:
            conn.close()


def db_config_get(key: str) -> Optional[str]:
    with _lock:
        conn = _get_conn()
        try:
            row = conn.execute("SELECT value FROM config WHERE key = ?", (key,)).fetchone()
            return row["value"] if row else None
        finally:
            conn.close()


def db_config_set(key: str, value: str) -> None:
    with _lock:
        conn = _get_conn()
        try:
            conn.execute("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)", (key, value))
            conn.commit()
        finally:
            conn.close()


def db_add(sig: Signature) -> None:
    with _lock:
        conn = _get_conn()
        try:
            conn.execute(
                "INSERT OR REPLACE INTO signatures (id, name, signature, timestamp, is_chief_guest) VALUES (?, ?, ?, ?, ?)",
                (sig.id, sig.name, sig.signature, sig.timestamp, 1 if sig.is_chief_guest else 0),
            )
            conn.commit()
        finally:
            conn.close()


def db_get_all_for_load() -> List[Signature]:
    """Returns all rows in chronological order (oldest first) for in-memory loading."""
    with _lock:
        conn = _get_conn()
        try:
            rows = conn.execute(
                "SELECT id, name, signature, timestamp, is_chief_guest FROM signatures ORDER BY timestamp ASC"
            ).fetchall()
            return [
                Signature(
                    id=r["id"], name=r["name"], signature=r["signature"],
                    timestamp=r["timestamp"], is_chief_guest=bool(r["is_chief_guest"]),
                )
                for r in rows
            ]
        finally:
            conn.close()


def db_get_all_meta(skip: int = 0, limit: int = 50) -> List[dict]:
    """Lightweight listing (no base64 data) for admin table, newest first."""
    with _lock:
        conn = _get_conn()
        try:
            rows = conn.execute(
                """SELECT id, name, timestamp,
                          (signature IS NOT NULL AND signature != '') AS has_sig,
                          is_chief_guest
                   FROM signatures ORDER BY timestamp DESC LIMIT ? OFFSET ?""",
                (limit, skip),
            ).fetchall()
            return [
                {
                    "id": r["id"],
                    "name": r["name"],
                    "timestamp": r["timestamp"],
                    "has_sig": bool(r["has_sig"]),
                    "is_chief_guest": bool(r["is_chief_guest"]),
                }
                for r in rows
            ]
        finally:
            conn.close()


def db_get_by_id(sig_id: str) -> Optional[Signature]:
    with _lock:
        conn = _get_conn()
        try:
            row = conn.execute(
                "SELECT id, name, signature, timestamp, is_chief_guest FROM signatures WHERE id = ?",
                (sig_id,),
            ).fetchone()
            if row:
                return Signature(
                    id=row["id"], name=row["name"],
                    signature=row["signature"], timestamp=row["timestamp"],
                    is_chief_guest=bool(row["is_chief_guest"]),
                )
            return None
        finally:
            conn.close()


def db_update_name(sig_id: str, new_name: str) -> bool:
    with _lock:
        conn = _get_conn()
        try:
            cur = conn.execute(
                "UPDATE signatures SET name = ? WHERE id = ?", (new_name, sig_id)
            )
            conn.commit()
            return cur.rowcount > 0
        finally:
            conn.close()


def db_set_chief_guest(sig_id: str, is_cg: bool) -> bool:
    with _lock:
        conn = _get_conn()
        try:
            cur = conn.execute(
                "UPDATE signatures SET is_chief_guest = ? WHERE id = ?",
                (1 if is_cg else 0, sig_id),
            )
            conn.commit()
            return cur.rowcount > 0
        finally:
            conn.close()


def db_delete(sig_id: str) -> bool:
    with _lock:
        conn = _get_conn()
        try:
            cur = conn.execute("DELETE FROM signatures WHERE id = ?", (sig_id,))
            conn.commit()
            return cur.rowcount > 0
        finally:
            conn.close()


def db_clear() -> None:
    with _lock:
        conn = _get_conn()
        try:
            conn.execute("DELETE FROM signatures")
            conn.commit()
        finally:
            conn.close()


def db_clear_audience() -> None:
    """Deletes only non-chief-guest signatures."""
    with _lock:
        conn = _get_conn()
        try:
            conn.execute("DELETE FROM signatures WHERE is_chief_guest = 0")
            conn.commit()
        finally:
            conn.close()


def db_clear_chief_guests() -> None:
    """Deletes only chief-guest signatures."""
    with _lock:
        conn = _get_conn()
        try:
            conn.execute("DELETE FROM signatures WHERE is_chief_guest = 1")
            conn.commit()
        finally:
            conn.close()


def db_count() -> int:
    with _lock:
        conn = _get_conn()
        try:
            row = conn.execute("SELECT COUNT(*) AS cnt FROM signatures").fetchone()
            return row["cnt"] if row else 0
        finally:
            conn.close()


def db_count_audience() -> int:
    with _lock:
        conn = _get_conn()
        try:
            row = conn.execute(
                "SELECT COUNT(*) AS cnt FROM signatures WHERE is_chief_guest = 0"
            ).fetchone()
            return row["cnt"] if row else 0
        finally:
            conn.close()
