"""API tests for GET /health — overall count plus the audience / chief-guest
breakdown used by the admin overview and the display counter."""


class TestHealth:
    def test_health_shape_when_empty(self, client):
        body = client.get("/health").json()
        assert body == {"status": "ok", "count": 0, "audience_count": 0, "cg_count": 0}

    def test_counts_audience_only_by_default(self, client):
        client.post("/submit", json={"name": "a"})
        client.post("/submit", json={"name": "b"})
        body = client.get("/health").json()
        assert body["count"] == 2
        assert body["audience_count"] == 2
        assert body["cg_count"] == 0

    def test_chief_guest_split(self, client):
        # Two audience members; promote one to chief guest.
        client.post("/submit", json={"name": "aud"})
        client.post("/submit", json={"name": "vip"})
        vip_id = [s for s in client.get("/signatures").json() if s["name"] == "vip"][0]["id"]
        client.put(
            f"/admin/db/signatures/{vip_id}/chief-guest",
            json={"is_chief_guest": True},
        )
        body = client.get("/health").json()
        assert body["count"] == 2
        assert body["audience_count"] == 1
        assert body["cg_count"] == 1
