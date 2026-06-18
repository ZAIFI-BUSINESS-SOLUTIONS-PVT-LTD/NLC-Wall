"""Tests for paths.py path selection in source and frozen modes."""

import importlib.util
import shutil
import sys
import tempfile
from pathlib import Path


def _make_workspace_tmp() -> Path:
    return Path(tempfile.mkdtemp(prefix="paths_test_", dir=str(Path.cwd())))


def _load_paths_with_sys(temp_root, monkeypatch, frozen=False):
    backend_dir = Path(__file__).resolve().parent.parent
    module_path = backend_dir / "paths.py"
    module_name = f"paths_under_test_{'frozen' if frozen else 'source'}"

    monkeypatch.setattr(sys, "frozen", frozen, raising=False)
    if frozen:
        bundle_dir = temp_root / "bundle"
        exe_dir = temp_root / "exe"
        bundle_dir.mkdir()
        exe_dir.mkdir()
        monkeypatch.setattr(sys, "_MEIPASS", str(bundle_dir), raising=False)
        monkeypatch.setattr(sys, "executable", str(exe_dir / "SignWall.exe"))
    else:
        monkeypatch.delattr(sys, "_MEIPASS", raising=False)

    spec = importlib.util.spec_from_file_location(module_name, module_path)
    mod = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(mod)
    return mod


def test_source_mode_uses_project_root_for_resources_and_data(monkeypatch):
    temp_root = _make_workspace_tmp()
    mod = _load_paths_with_sys(temp_root, monkeypatch, frozen=False)
    shutil.rmtree(temp_root, ignore_errors=True)
    root = Path(__file__).resolve().parents[2]

    assert mod.RESOURCE_DIR == root
    assert mod.DATA_DIR == root
    assert mod.DB_PATH == root / "signwall.db"
    assert mod.FRONTEND_DIST == root / "frontend" / "dist"


def test_frozen_mode_reads_assets_from_meipass_and_writes_next_to_exe(monkeypatch):
    temp_root = _make_workspace_tmp()
    mod = _load_paths_with_sys(temp_root, monkeypatch, frozen=True)

    assert mod.RESOURCE_DIR == temp_root / "bundle"
    assert mod.DATA_DIR == temp_root / "exe"
    assert mod.DB_PATH == temp_root / "exe" / "signwall.db"
    assert mod.SIGNATURES_DIR == temp_root / "exe" / "signatures"
    assert mod.FRONTEND_DIST == temp_root / "bundle" / "frontend" / "dist"
    shutil.rmtree(temp_root, ignore_errors=True)
