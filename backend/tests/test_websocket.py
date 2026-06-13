"""Tests for the /ws WebSocket channel — the initial handshake frames a client
receives on connect, and every server-side broadcast the display wall relies on
to stay in sync (new/remove/update signature, clears, theme & config pushes)."""

import storage


INIT_EVENTS = ["init", "display_theme", "pledge_config", "cg_config"]


def drain_init(ws):
    """Receive and return the four frames sent immediately after connect."""
    frames = [ws.receive_json() for _ in INIT_EVENTS]
    return {f["event"]: f for f in frames}


# ───────────────────────── connect handshake ───────────────────────────

class TestHandshake:
    def test_init_frames_in_order(self, client):
        with client.websocket_connect("/ws") as ws:
            events = [ws.receive_json()["event"] for _ in INIT_EVENTS]
        assert events == INIT_EVENTS

    def test_init_carries_existing_signatures(self, client, make_signature):
        storage.add(make_signature(name="AlreadyHere"))
        with client.websocket_connect("/ws") as ws:
            frames = drain_init(ws)
        assert frames["init"]["data"][0]["name"] == "AlreadyHere"

    def test_handshake_includes_current_theme_and_configs(self, client):
        with client.websocket_connect("/ws") as ws:
            frames = drain_init(ws)
        assert frames["display_theme"]["theme"] == "sky"
        assert "config" in frames["pledge_config"]
        assert "config" in frames["cg_config"]


# ───────────────────────── signature broadcasts ────────────────────────

class TestSignatureBroadcasts:
    def test_new_signature_broadcast(self, client):
        with client.websocket_connect("/ws") as ws:
            drain_init(ws)
            client.post("/submit", json={"name": "Broadcast Me"})
            msg = ws.receive_json()
        assert msg["event"] == "new_signature"
        assert msg["data"]["name"] == "Broadcast Me"

    def test_remove_signature_broadcast(self, client, make_signature):
        sig = make_signature(name="Gone")
        storage.add(sig)
        with client.websocket_connect("/ws") as ws:
            drain_init(ws)
            client.delete(f"/admin/db/signatures/{sig.id}")
            msg = ws.receive_json()
        assert msg["event"] == "remove_signature"
        assert msg["id"] == sig.id

    def test_update_signature_broadcast_on_cg_toggle(self, client, make_signature):
        sig = make_signature(name="Promote")
        storage.add(sig)
        with client.websocket_connect("/ws") as ws:
            drain_init(ws)
            client.put(f"/admin/db/signatures/{sig.id}/chief-guest", json={"is_chief_guest": True})
            msg = ws.receive_json()
        assert msg["event"] == "update_signature"
        assert msg["data"]["is_chief_guest"] is True


# ───────────────────────── clear broadcasts ────────────────────────────

class TestClearBroadcasts:
    def test_clear_audience_broadcast(self, client, make_signature):
        storage.add(make_signature(name="aud"))
        with client.websocket_connect("/ws") as ws:
            drain_init(ws)
            client.delete("/admin/signatures")
            msg = ws.receive_json()
        assert msg["event"] == "clear"

    def test_clear_chief_guests_broadcast(self, client, make_signature):
        storage.add(make_signature(name="cg", is_chief_guest=True))
        with client.websocket_connect("/ws") as ws:
            drain_init(ws)
            client.delete("/admin/chief-guest-signatures")
            msg = ws.receive_json()
        assert msg["event"] == "clear_chief_guests"


# ───────────────────────── config broadcasts ───────────────────────────

class TestConfigBroadcasts:
    def test_display_theme_broadcast(self, client):
        with client.websocket_connect("/ws") as ws:
            drain_init(ws)
            client.post("/admin/display-theme", json={"theme": "neon"})
            msg = ws.receive_json()
        assert msg["event"] == "display_theme"
        assert msg["theme"] == "neon"

    def test_pledge_config_broadcast(self, client):
        with client.websocket_connect("/ws") as ws:
            drain_init(ws)
            client.post("/admin/pledge-config", json={"english": "Hi", "duration_seconds": 20})
            msg = ws.receive_json()
        assert msg["event"] == "pledge_config"
        assert msg["config"]["english"] == "Hi"

    def test_cg_config_broadcast(self, client):
        with client.websocket_connect("/ws") as ws:
            drain_init(ws)
            client.post(
                "/admin/chief-guest-config",
                json={"enabled": True, "retention_mode": "forever", "retention_until": None},
            )
            msg = ws.receive_json()
        assert msg["event"] == "cg_config"
        assert msg["config"]["enabled"] is True


# ───────────────────────── fan-out to many clients ─────────────────────

class TestMultipleClients:
    def test_broadcast_reaches_all_connected_clients(self, client):
        with client.websocket_connect("/ws") as ws1, client.websocket_connect("/ws") as ws2:
            drain_init(ws1)
            drain_init(ws2)
            client.post("/submit", json={"name": "Everyone"})
            m1 = ws1.receive_json()
            m2 = ws2.receive_json()
        assert m1["event"] == "new_signature" == m2["event"]
        assert m1["data"]["name"] == "Everyone" == m2["data"]["name"]
