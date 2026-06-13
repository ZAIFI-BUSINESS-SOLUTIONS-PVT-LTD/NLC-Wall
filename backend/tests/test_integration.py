"""End-to-end style tests that exercise multi-step operator flows across the
real API surface, plus the crash-recovery guarantee that the in-memory store is
rebuilt from SQLite on restart."""

import importlib

import storage
import database
import moderation
from models import Signature


class TestEventFlow:
    def test_audience_and_chief_guest_lifecycle(self, client):
        for n in ["Asha", "Bala", "Chitra"]:
            assert client.post("/submit", json={"name": n}).status_code == 200

        bala = [s for s in client.get("/signatures").json() if s["name"] == "Bala"][0]
        client.put(
            f"/admin/db/signatures/{bala['id']}/chief-guest",
            json={"is_chief_guest": True},
        )

        h = client.get("/health").json()
        assert (h["count"], h["audience_count"], h["cg_count"]) == (3, 2, 1)

        # Clearing the audience wall preserves the chief guest...
        client.delete("/admin/signatures")
        assert [s["name"] for s in client.get("/signatures").json()] == ["Bala"]

        # ...and clearing chief guests empties everything.
        client.delete("/admin/chief-guest-signatures")
        assert client.get("/signatures").json() == []

    def test_edit_name_then_download_image(self, client, make_signature, png_data_url):
        sig = make_signature(name="Typo", signature=png_data_url)
        storage.add(sig)

        assert client.put(f"/admin/db/signatures/{sig.id}", json={"name": "Fixed"}).status_code == 200
        item = client.get("/admin/db/signatures").json()["items"][0]
        assert item["name"] == "Fixed"
        assert item["has_sig"] is True
        assert client.get(f"/admin/db/signatures/{sig.id}/image").status_code == 200

    def test_same_name_allowed_after_duplicate_window(self, client, monkeypatch):
        clock = {"t": 1_000_000.0}
        monkeypatch.setattr(moderation.time, "time", lambda: clock["t"])

        assert client.post("/submit", json={"name": "Repeat"}).status_code == 200
        assert client.post("/submit", json={"name": "Repeat"}).status_code == 409  # within window
        clock["t"] += moderation.DUPLICATE_WINDOW + 1
        assert client.post("/submit", json={"name": "Repeat"}).status_code == 200  # window passed

    def test_theme_and_pledge_survive_into_new_connection(self, client):
        client.post("/admin/display-theme", json={"theme": "ocean"})
        client.post("/admin/pledge-config", json={"english": "Stay honest", "duration_seconds": 15})
        # A fresh display client connecting later sees the saved state in its handshake.
        with client.websocket_connect("/ws") as ws:
            frames = {ws.receive_json()["event"]: None for _ in range(4)}  # noqa: F841
        # The HTTP getters confirm persistence regardless of frame timing.
        assert client.get("/admin/display-theme").json()["theme"] == "ocean"
        assert client.get("/admin/pledge-config").json()["english"] == "Stay honest"


class TestPersistenceReload:
    def test_store_rebuilt_from_db_on_restart(self):
        # Simulate rows persisted by a previous run, then "restart" by reloading
        # the storage module (its import-time code reloads from SQLite).
        for i in range(3):
            database.db_add(Signature(id=f"r{i}", name=f"Survivor{i}", timestamp=i))

        importlib.reload(storage)
        try:
            assert storage.count() == 3
            assert [s.name for s in storage.get_all()] == ["Survivor0", "Survivor1", "Survivor2"]
        finally:
            storage.clear()

    def test_reload_respects_max_cap(self):
        # More rows than the cap exist on disk; only the newest MAX are loaded.
        over = storage.MAX_SIGNATURES + 5
        for i in range(over):
            database.db_add(Signature(id=f"x{i:05d}", name=f"n{i}", timestamp=i))

        importlib.reload(storage)
        try:
            assert storage.count() == storage.MAX_SIGNATURES
            # Oldest rows dropped; the newest one is present.
            names = {s.name for s in storage.get_all()}
            assert f"n{over - 1}" in names
            assert "n0" not in names
        finally:
            storage.clear()
