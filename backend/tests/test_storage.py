"""Unit tests for storage.py — the in-memory store, the 500-item FIFO cap,
chief-guest aware counting/clearing, and automatic disk persistence of PNGs."""

import datetime

import pytest

import storage
import database
import paths


# ───────────────────────── add / count ─────────────────────────────────

class TestAddAndCount:
    def test_add_increases_count(self, make_signature):
        storage.add(make_signature(name="A"))
        assert storage.count() == 1

    def test_add_persists_to_database(self, make_signature):
        sig = make_signature(name="Persisted")
        storage.add(sig)
        assert database.db_count() == 1
        assert database.db_get_by_id(sig.id).name == "Persisted"

    def test_get_all_returns_copy_not_internal_list(self, make_signature):
        storage.add(make_signature(name="A"))
        got = storage.get_all()
        got.clear()  # mutating the returned list must not affect the store
        assert storage.count() == 1

    def test_get_all_preserves_insertion_order(self, make_signature):
        for n in ["first", "second", "third"]:
            storage.add(make_signature(name=n))
        assert [s.name for s in storage.get_all()] == ["first", "second", "third"]


# ───────────────────────── audience counting ───────────────────────────

class TestCountAudience:
    def test_counts_only_non_chief_guests(self, make_signature):
        storage.add(make_signature(name="aud1"))
        storage.add(make_signature(name="aud2"))
        storage.add(make_signature(name="cg1", is_chief_guest=True))
        assert storage.count() == 3
        assert storage.count_audience() == 2

    def test_empty_store_counts_zero(self):
        assert storage.count() == 0
        assert storage.count_audience() == 0


# ───────────────────────── 500-item FIFO cap ───────────────────────────

class TestMaxSignaturesCap:
    def test_memory_capped_at_max(self, make_signature):
        for i in range(storage.MAX_SIGNATURES + 25):
            storage.add(make_signature(name=f"n{i}"))
        assert storage.count() == storage.MAX_SIGNATURES

    def test_oldest_is_evicted_from_memory(self, make_signature):
        first = make_signature(name="OLDEST")
        storage.add(first)
        for i in range(storage.MAX_SIGNATURES):
            storage.add(make_signature(name=f"n{i}"))
        names = [s.name for s in storage.get_all()]
        assert "OLDEST" not in names
        assert len(names) == storage.MAX_SIGNATURES

    def test_database_keeps_all_rows_beyond_cap(self, make_signature):
        # The disk/DB record is the durable archive — it is NOT capped at 500.
        total = storage.MAX_SIGNATURES + 10
        for i in range(total):
            storage.add(make_signature(name=f"n{i}"))
        assert database.db_count() == total


# ───────────────────────── remove / update / cg ────────────────────────

class TestMutations:
    def test_remove_existing_returns_true(self, make_signature):
        sig = make_signature(name="X")
        storage.add(sig)
        assert storage.remove(sig.id) is True
        assert storage.count() == 0
        assert database.db_get_by_id(sig.id) is None

    def test_remove_missing_returns_false(self):
        assert storage.remove("does-not-exist") is False

    def test_update_name_changes_memory_and_db(self, make_signature):
        sig = make_signature(name="Before")
        storage.add(sig)
        assert storage.update_name(sig.id, "After") is True
        assert storage.get_all()[0].name == "After"
        assert database.db_get_by_id(sig.id).name == "After"

    def test_update_name_missing_returns_false(self):
        assert storage.update_name("nope", "X") is False

    def test_set_chief_guest_toggle(self, make_signature):
        sig = make_signature(name="VIP")
        storage.add(sig)
        assert storage.set_chief_guest(sig.id, True) is True
        assert storage.get_all()[0].is_chief_guest is True
        assert database.db_get_by_id(sig.id).is_chief_guest is True
        # And back off.
        storage.set_chief_guest(sig.id, False)
        assert storage.get_all()[0].is_chief_guest is False

    def test_set_chief_guest_missing_returns_false(self):
        assert storage.set_chief_guest("nope", True) is False


# ───────────────────────── clear variants ──────────────────────────────

class TestClearing:
    def _seed(self, make_signature):
        storage.add(make_signature(name="aud1"))
        storage.add(make_signature(name="aud2"))
        storage.add(make_signature(name="cg1", is_chief_guest=True))
        storage.add(make_signature(name="cg2", is_chief_guest=True))

    def test_clear_audience_keeps_chief_guests(self, make_signature):
        self._seed(make_signature)
        storage.clear_audience()
        names = sorted(s.name for s in storage.get_all())
        assert names == ["cg1", "cg2"]
        assert database.db_count() == 2

    def test_clear_chief_guests_keeps_audience(self, make_signature):
        self._seed(make_signature)
        storage.clear_chief_guests()
        names = sorted(s.name for s in storage.get_all())
        assert names == ["aud1", "aud2"]
        assert database.db_count() == 2

    def test_clear_removes_everything(self, make_signature):
        self._seed(make_signature)
        storage.clear()
        assert storage.count() == 0
        assert database.db_count() == 0


# ───────────────────────── disk persistence ────────────────────────────

class TestDiskSave:
    def test_signature_written_to_dated_folder(self, make_signature, png_data_url):
        ts = int(datetime.datetime(2026, 6, 14, 10, 0, 0).timestamp() * 1000)
        sig = make_signature(name="Disk", signature=png_data_url, timestamp=ts)
        storage.add(sig)
        day_dir = paths.SIGNATURES_DIR / "2026-06-14"
        expected = day_dir / f"{ts}_{sig.id[:8]}.png"
        assert expected.exists()
        assert expected.read_bytes()[:8] == b"\x89PNG\r\n\x1a\n"

    def test_no_signature_writes_no_file(self, make_signature):
        sig = make_signature(name="NoSig", signature=None)
        storage.add(sig)
        # The dated folder should not be created for a signature-less entry.
        assert not any(paths.SIGNATURES_DIR.glob("**/*.png"))

    def test_malformed_signature_does_not_crash_add(self, make_signature):
        # No comma → split/unpack fails inside _save_to_disk, but it is caught
        # and logged; the signature is still stored in memory and DB.
        sig = make_signature(name="Bad", signature="not-a-data-url")
        storage.add(sig)  # must not raise
        assert storage.count() == 1
        assert database.db_get_by_id(sig.id) is not None
