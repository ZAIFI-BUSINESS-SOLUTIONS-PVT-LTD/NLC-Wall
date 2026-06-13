"""Unit tests for database.py — the SQLite persistence layer: schema init,
config key/value store, signature CRUD, metadata listing/pagination and the
selective clear helpers."""

import time

import pytest

import database
from models import Signature


def _sig(name="X", signature=None, is_cg=False, ts=None):
    return Signature(
        id=f"{name}-{ts or time.time_ns()}",
        name=name,
        signature=signature,
        timestamp=ts if ts is not None else int(time.time() * 1000),
        is_chief_guest=is_cg,
    )


# ───────────────────────── schema / init ───────────────────────────────

class TestInitDb:
    def test_init_db_is_idempotent(self):
        database.init_db()
        database.init_db()  # second call must not raise
        # tables exist and are queryable
        assert database.db_count() == 0

    def test_signatures_table_has_is_chief_guest_column(self):
        conn = database._get_conn()
        try:
            cols = [r[1] for r in conn.execute("PRAGMA table_info(signatures)").fetchall()]
        finally:
            conn.close()
        assert "is_chief_guest" in cols


# ───────────────────────── config store ────────────────────────────────

class TestConfigStore:
    def test_missing_key_returns_none(self):
        assert database.db_config_get("nope") is None

    def test_set_then_get(self):
        database.db_config_set("k", "v")
        assert database.db_config_get("k") == "v"

    def test_set_overwrites_existing(self):
        database.db_config_set("k", "v1")
        database.db_config_set("k", "v2")
        assert database.db_config_get("k") == "v2"


# ───────────────────────── add / get_by_id ─────────────────────────────

class TestAddAndGet:
    def test_add_and_fetch_full_record(self):
        sig = _sig(name="Full", signature="data:image/png;base64,AAAA", is_cg=True, ts=111)
        database.db_add(sig)
        got = database.db_get_by_id(sig.id)
        assert got.name == "Full"
        assert got.signature == "data:image/png;base64,AAAA"
        assert got.is_chief_guest is True
        assert got.timestamp == 111

    def test_get_missing_returns_none(self):
        assert database.db_get_by_id("missing") is None

    def test_add_same_id_replaces(self):
        sig = _sig(name="Orig", ts=1)
        database.db_add(sig)
        sig.name = "Replaced"
        database.db_add(sig)
        assert database.db_count() == 1
        assert database.db_get_by_id(sig.id).name == "Replaced"


# ───────────────────────── load ordering ───────────────────────────────

class TestLoadOrder:
    def test_load_returns_chronological_ascending(self):
        database.db_add(_sig(name="newest", ts=300))
        database.db_add(_sig(name="oldest", ts=100))
        database.db_add(_sig(name="middle", ts=200))
        loaded = database.db_get_all_for_load()
        assert [s.name for s in loaded] == ["oldest", "middle", "newest"]

    def test_load_restores_chief_guest_flag(self):
        database.db_add(_sig(name="vip", is_cg=True, ts=1))
        loaded = database.db_get_all_for_load()
        assert loaded[0].is_chief_guest is True


# ───────────────────────── metadata listing ────────────────────────────

class TestMetaListing:
    def test_meta_is_newest_first(self):
        database.db_add(_sig(name="old", ts=1))
        database.db_add(_sig(name="new", ts=2))
        items = database.db_get_all_meta()
        assert [i["name"] for i in items] == ["new", "old"]

    def test_meta_excludes_base64_payload(self):
        database.db_add(_sig(name="x", signature="data:image/png;base64,AAAA", ts=1))
        item = database.db_get_all_meta()[0]
        assert "signature" not in item
        assert item["has_sig"] is True

    def test_meta_has_sig_false_for_none_and_empty(self):
        database.db_add(_sig(name="none", signature=None, ts=1))
        database.db_add(_sig(name="empty", signature="", ts=2))
        by_name = {i["name"]: i for i in database.db_get_all_meta()}
        assert by_name["none"]["has_sig"] is False
        assert by_name["empty"]["has_sig"] is False

    def test_meta_pagination_skip_and_limit(self):
        for i in range(5):
            database.db_add(_sig(name=f"n{i}", ts=i))
        page = database.db_get_all_meta(skip=2, limit=2)
        # newest-first => n4, n3, [n2, n1], n0  -> skip 2 then take 2 = n2, n1
        assert [i["name"] for i in page] == ["n2", "n1"]

    def test_meta_chief_guest_flag_is_bool(self):
        database.db_add(_sig(name="vip", is_cg=True, ts=1))
        assert database.db_get_all_meta()[0]["is_chief_guest"] is True


# ───────────────────────── update / delete ─────────────────────────────

class TestUpdateDelete:
    def test_update_name_existing(self):
        sig = _sig(name="Before", ts=1)
        database.db_add(sig)
        assert database.db_update_name(sig.id, "After") is True
        assert database.db_get_by_id(sig.id).name == "After"

    def test_update_name_missing(self):
        assert database.db_update_name("missing", "X") is False

    def test_set_chief_guest_persists_as_bool(self):
        sig = _sig(name="x", ts=1)
        database.db_add(sig)
        assert database.db_set_chief_guest(sig.id, True) is True
        assert database.db_get_by_id(sig.id).is_chief_guest is True

    def test_set_chief_guest_missing(self):
        assert database.db_set_chief_guest("missing", True) is False

    def test_delete_existing_and_missing(self):
        sig = _sig(name="x", ts=1)
        database.db_add(sig)
        assert database.db_delete(sig.id) is True
        assert database.db_delete(sig.id) is False


# ───────────────────────── clear helpers ───────────────────────────────

class TestClearHelpers:
    def _seed(self):
        database.db_add(_sig(name="aud1", ts=1))
        database.db_add(_sig(name="cg1", is_cg=True, ts=2))
        database.db_add(_sig(name="aud2", ts=3))
        database.db_add(_sig(name="cg2", is_cg=True, ts=4))

    def test_clear_audience_only(self):
        self._seed()
        database.db_clear_audience()
        names = sorted(i["name"] for i in database.db_get_all_meta())
        assert names == ["cg1", "cg2"]

    def test_clear_chief_guests_only(self):
        self._seed()
        database.db_clear_chief_guests()
        names = sorted(i["name"] for i in database.db_get_all_meta())
        assert names == ["aud1", "aud2"]

    def test_clear_all(self):
        self._seed()
        database.db_clear()
        assert database.db_count() == 0
