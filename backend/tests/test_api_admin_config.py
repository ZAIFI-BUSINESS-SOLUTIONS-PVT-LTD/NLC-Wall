"""API tests for the admin configuration endpoints: display theme, multilingual
pledge config, and chief-guest config — including validation, clamping and DB
persistence."""

import json

import database


# ───────────────────────── display theme ───────────────────────────────

class TestDisplayTheme:
    def test_default_is_sky(self, client):
        assert client.get("/admin/display-theme").json()["theme"] == "sky"

    def test_set_valid_theme(self, client):
        r = client.post("/admin/display-theme", json={"theme": "space"})
        assert r.status_code == 200
        assert r.json()["theme"] == "space"
        assert client.get("/admin/display-theme").json()["theme"] == "space"

    def test_invalid_theme_rejected_400(self, client):
        r = client.post("/admin/display-theme", json={"theme": "rainbow"})
        assert r.status_code == 400
        assert "invalid theme" in r.json()["detail"].lower()

    def test_all_seven_themes_accepted(self, client):
        for t in ["sky", "space", "aurora", "ocean", "neon", "forest", "sunset"]:
            assert client.post("/admin/display-theme", json={"theme": t}).status_code == 200


# ───────────────────────── pledge config ───────────────────────────────

class TestPledgeConfig:
    def test_get_returns_defaults(self, client):
        body = client.get("/admin/pledge-config").json()
        assert set(body.keys()) == {"tamil", "hindi", "english", "duration_seconds"}
        assert body["duration_seconds"] == 90

    def test_post_updates_and_persists(self, client):
        payload = {"tamil": "தமிழ்", "hindi": "हिन्दी", "english": "English", "duration_seconds": 30}
        r = client.post("/admin/pledge-config", json=payload)
        assert r.status_code == 200
        saved = r.json()
        assert saved["english"] == "English"
        assert saved["duration_seconds"] == 30
        # Persisted to the SQLite config table.
        stored = json.loads(database.db_config_get("pledge_config"))
        assert stored["tamil"] == "தமிழ்"
        # And reflected on subsequent GET.
        assert client.get("/admin/pledge-config").json()["english"] == "English"

    def test_duration_clamped_high(self, client):
        r = client.post("/admin/pledge-config", json={"duration_seconds": 100000})
        assert r.json()["duration_seconds"] == 600

    def test_duration_clamped_low(self, client):
        r = client.post("/admin/pledge-config", json={"duration_seconds": 1})
        assert r.json()["duration_seconds"] == 5

    def test_text_truncated_to_4000(self, client):
        r = client.post("/admin/pledge-config", json={"english": "e" * 5000})
        assert len(r.json()["english"]) == 4000

    def test_empty_languages_allowed(self, client):
        r = client.post("/admin/pledge-config", json={"tamil": "", "hindi": "", "english": ""})
        assert r.status_code == 200


# ───────────────────────── chief-guest config ──────────────────────────

class TestChiefGuestConfig:
    def test_get_returns_defaults(self, client):
        body = client.get("/admin/chief-guest-config").json()
        assert body == {"enabled": False, "retention_mode": "forever", "retention_until": None}

    def test_enable_forever(self, client):
        r = client.post(
            "/admin/chief-guest-config",
            json={"enabled": True, "retention_mode": "forever", "retention_until": None},
        )
        assert r.status_code == 200
        assert r.json()["enabled"] is True

    def test_until_datetime_with_timestamp(self, client):
        ts = 1_900_000_000_000
        r = client.post(
            "/admin/chief-guest-config",
            json={"enabled": True, "retention_mode": "until_datetime", "retention_until": ts},
        )
        assert r.status_code == 200
        assert r.json()["retention_until"] == ts
        stored = json.loads(database.db_config_get("cg_config"))
        assert stored["retention_until"] == ts

    def test_invalid_mode_rejected_422(self, client):
        r = client.post(
            "/admin/chief-guest-config",
            json={"enabled": True, "retention_mode": "sometime", "retention_until": None},
        )
        assert r.status_code == 422

    def test_config_persists_across_get(self, client):
        client.post(
            "/admin/chief-guest-config",
            json={"enabled": True, "retention_mode": "forever", "retention_until": None},
        )
        assert client.get("/admin/chief-guest-config").json()["enabled"] is True
