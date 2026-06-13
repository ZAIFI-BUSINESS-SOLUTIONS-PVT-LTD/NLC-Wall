"""Shared pytest fixtures and test isolation for the Live Sign Wall backend.

The backend binds writable paths (SQLite DB, signature PNG folder, log file) at
import time via ``from paths import X``. To keep the real ``signwall.db`` and the
operator's signature folders untouched, we redirect every writable path to a
throwaway temp directory *before* importing any backend module that captures
those names. Each test then runs against a clean, isolated state.
"""

import sys
import shutil
import tempfile
from pathlib import Path

import pytest

# --- Make the backend package importable (parent of this tests/ directory) ----
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# --- Redirect writable paths BEFORE importing database/storage/main -----------
# These modules do `from paths import DB_PATH / SIGNATURES_DIR / LOG_PATH`, so the
# patch must happen before they are first imported anywhere.
_TMP_ROOT = Path(tempfile.mkdtemp(prefix="signwall_tests_"))

import paths  # noqa: E402

paths.DB_PATH = _TMP_ROOT / "signwall_test.db"
paths.SIGNATURES_DIR = _TMP_ROOT / "signatures"
paths.LOG_PATH = _TMP_ROOT / "signwall_test.log"
# Point the bundled-frontend dir at something that does not exist so the static
# file mounting block in main.py is skipped — these are pure API/logic tests.
paths.FRONTEND_DIST = _TMP_ROOT / "frontend" / "dist"

# Now the backend modules pick up the patched values on first import.
import database  # noqa: E402
import storage  # noqa: E402
import moderation  # noqa: E402
import main as main_module  # noqa: E402
from models import Signature  # noqa: E402
from pledge_defaults import DEFAULT_PLEDGE_CONFIG  # noqa: E402


# A minimal valid 1x1 transparent PNG, as a data URL (what the canvas exports).
PNG_DATA_URL = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)


def _wipe_config_table() -> None:
    conn = database._get_conn()
    try:
        conn.execute("DELETE FROM config")
        conn.commit()
    finally:
        conn.close()


@pytest.fixture(autouse=True)
def isolate_state():
    """Reset all process-global state so each test starts from a clean slate."""
    # 1) Signatures: clear in-memory store + DB rows.
    storage.clear()
    _wipe_config_table()

    # 2) Signature PNG folder.
    if paths.SIGNATURES_DIR.exists():
        shutil.rmtree(paths.SIGNATURES_DIR, ignore_errors=True)

    # 3) Moderation in-memory counters.
    with moderation._lock:
        moderation._ip_timestamps.clear()
        moderation._recent_names.clear()

    # 4) Server-side config globals back to defaults.
    main_module._display_theme = "sky"
    main_module._pledge_config = dict(DEFAULT_PLEDGE_CONFIG)
    main_module._cg_config = {
        "enabled": False,
        "retention_mode": "forever",
        "retention_until": None,
    }

    yield

    storage.clear()
    _wipe_config_table()


@pytest.fixture
def client():
    """A FastAPI TestClient with lifespan started (needed for WebSocket tests)."""
    from fastapi.testclient import TestClient

    with TestClient(main_module.app) as c:
        yield c


@pytest.fixture
def png_data_url():
    return PNG_DATA_URL


@pytest.fixture
def make_signature():
    """Factory for Signature model objects with sensible defaults."""
    import time
    import uuid

    def _make(name="Tester", signature=None, is_chief_guest=False, timestamp=None):
        return Signature(
            id=str(uuid.uuid4()),
            name=name,
            signature=signature,
            timestamp=timestamp if timestamp is not None else int(time.time() * 1000),
            is_chief_guest=is_chief_guest,
        )

    return _make


# Re-export modules so test files can `from conftest import ...` if convenient.
__all__ = [
    "database",
    "storage",
    "moderation",
    "main_module",
    "Signature",
    "DEFAULT_PLEDGE_CONFIG",
    "PNG_DATA_URL",
]
