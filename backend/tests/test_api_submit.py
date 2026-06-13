"""API tests for POST /submit, GET /signatures and the moderation gates that
guard submission (validation 422, profanity 400, duplicate 409, rate-limit 429)."""

import paths


# ───────────────────────── happy path ──────────────────────────────────

class TestSubmitHappyPath:
    def test_submit_returns_id_and_timestamp(self, client):
        r = client.post("/submit", json={"name": "Rishi"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "id" in body and isinstance(body["id"], str)
        assert isinstance(body["timestamp"], int)

    def test_submit_stores_signature(self, client):
        client.post("/submit", json={"name": "Stored"})
        sigs = client.get("/signatures").json()
        assert len(sigs) == 1
        assert sigs[0]["name"] == "Stored"
        assert sigs[0]["is_chief_guest"] is False

    def test_submit_with_image_writes_png_to_disk(self, client, png_data_url):
        client.post("/submit", json={"name": "Drawn", "signature": png_data_url})
        pngs = list(paths.SIGNATURES_DIR.glob("**/*.png"))
        assert len(pngs) == 1

    def test_submit_without_signature_is_allowed(self, client):
        r = client.post("/submit", json={"name": "NoSig"})
        assert r.status_code == 200
        assert client.get("/signatures").json()[0]["signature"] is None

    def test_name_is_trimmed_server_side(self, client):
        client.post("/submit", json={"name": "   Spaced   "})
        assert client.get("/signatures").json()[0]["name"] == "Spaced"

    def test_tamil_name_round_trips(self, client):
        tamil = "மணிகண்டன்"
        client.post("/submit", json={"name": tamil})
        assert client.get("/signatures").json()[0]["name"] == tamil


# ───────────────────────── validation (422) ────────────────────────────

class TestSubmitValidation:
    def test_empty_name_unprocessable(self, client):
        assert client.post("/submit", json={"name": ""}).status_code == 422

    def test_whitespace_name_unprocessable(self, client):
        assert client.post("/submit", json={"name": "    "}).status_code == 422

    def test_name_too_long_unprocessable(self, client):
        assert client.post("/submit", json={"name": "A" * 61}).status_code == 422

    def test_missing_name_unprocessable(self, client):
        assert client.post("/submit", json={}).status_code == 422

    def test_signature_too_large_unprocessable(self, client):
        big = "d" * 200_001
        assert client.post("/submit", json={"name": "Big", "signature": big}).status_code == 422


# ───────────────────────── moderation gates ────────────────────────────

class TestSubmitModeration:
    def test_profane_name_rejected_400(self, client):
        r = client.post("/submit", json={"name": "you bastard"})
        assert r.status_code == 400
        assert "prohibited" in r.json()["detail"].lower()

    def test_duplicate_name_rejected_409(self, client):
        assert client.post("/submit", json={"name": "Twin"}).status_code == 200
        r = client.post("/submit", json={"name": "Twin"})
        assert r.status_code == 409

    def test_rate_limit_returns_429(self, client):
        # 15 distinct names allowed from one IP, the 16th is throttled.
        from moderation import RATE_LIMIT_COUNT

        for i in range(RATE_LIMIT_COUNT):
            assert client.post("/submit", json={"name": f"user{i}"}).status_code == 200
        r = client.post("/submit", json={"name": "one-too-many"})
        assert r.status_code == 429
        assert "many" in r.json()["detail"].lower()


# ───────────────────────── GET /signatures ─────────────────────────────

class TestGetSignatures:
    def test_empty_initially(self, client):
        assert client.get("/signatures").json() == []

    def test_returns_full_records_with_base64(self, client, png_data_url):
        client.post("/submit", json={"name": "Img", "signature": png_data_url})
        sigs = client.get("/signatures").json()
        assert sigs[0]["signature"] == png_data_url

    def test_order_is_insertion_order(self, client):
        for n in ["one", "two", "three"]:
            client.post("/submit", json={"name": n})
        assert [s["name"] for s in client.get("/signatures").json()] == ["one", "two", "three"]
