# PyInstaller spec — builds a single SignWall.exe that bundles the FastAPI
# backend and the prebuilt React frontend (frontend/dist).
#
# Build with:  pyinstaller packaging/signwall.spec --noconfirm
# (the build_exe.bat script wraps this and rebuilds the frontend first)

import os
from PyInstaller.utils.hooks import collect_submodules

# SPECPATH is provided by PyInstaller; packaging/ -> project root is one level up.
ROOT = os.path.abspath(os.path.join(SPECPATH, os.pardir))
BACKEND = os.path.join(ROOT, "backend")
FRONTEND_DIST = os.path.join(ROOT, "frontend", "dist")

# uvicorn/websockets/anyio load their implementations dynamically, so PyInstaller's
# static analysis misses them — pull every submodule in explicitly.
hidden = (
    collect_submodules("uvicorn")
    + collect_submodules("websockets")
    + collect_submodules("anyio")
    + ["uvicorn.logging", "uvicorn.loops.auto", "uvicorn.protocols.http.auto",
       "uvicorn.protocols.websockets.auto", "uvicorn.lifespan.on"]
)

# Ship the built frontend inside the exe, under frontend/dist (matches paths.py).
datas = [(FRONTEND_DIST, os.path.join("frontend", "dist"))]

a = Analysis(
    [os.path.join(BACKEND, "run.py")],
    pathex=[BACKEND],
    binaries=[],
    datas=datas,
    hiddenimports=hidden,
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="SignWall",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    runtime_tmpdir=None,
    console=True,          # keep the console window so the operator can see status / close to stop
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
