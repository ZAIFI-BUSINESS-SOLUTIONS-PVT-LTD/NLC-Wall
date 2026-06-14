"""Central path resolution that works both from source and as a frozen PyInstaller .exe.

Two kinds of paths:
  * RESOURCE_DIR — read-only bundled assets (the built frontend). When frozen these
    live inside the temporary extraction dir (sys._MEIPASS); from source they live in
    the project root.
  * DATA_DIR — writable, persistent data (SQLite DB, signature PNGs, log). When frozen
    this is the folder the .exe sits in, so data survives across runs and is easy for
    the operator to find. From source it is the project root (unchanged behaviour).
"""

import sys
from pathlib import Path


def _is_frozen() -> bool:
    return getattr(sys, "frozen", False)


if _is_frozen():
    RESOURCE_DIR = Path(getattr(sys, "_MEIPASS"))
    DATA_DIR = Path(sys.executable).resolve().parent
else:
    # backend/paths.py -> project root is one level up from backend/
    _root = Path(__file__).resolve().parent.parent
    RESOURCE_DIR = _root
    DATA_DIR = _root

FRONTEND_DIST = RESOURCE_DIR / "frontend" / "dist"

DB_PATH = DATA_DIR / "signwall.db"
SIGNATURES_DIR = DATA_DIR / "signatures"
LOG_PATH = DATA_DIR / "signwall.log"
