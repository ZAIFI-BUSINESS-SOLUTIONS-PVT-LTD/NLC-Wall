"""API tests for the admin signature-management endpoints: the clear actions,
the paginated DB listing, name editing, chief-guest toggling, deletion, the
per-signature image download, and the save-images-to-disk action."""

import shutil

import storage
import paths


# ───────────────────────── clear endpoints ─────────────────────────────

class TestClearEndpoints:
    def _seed(self, make_signature):
        storage.add(make_signature(name="aud1"))
        storage.add(make_signature(name="aud2"))
        storage.add(make_signature(name="cg1", is_chief_guest=True))

    def test_clear_audience_keeps_chief_guests(self, client, make_signature):
        self._seed(make_signature)
        r = client.delete("/admin/signatures")
        assert r.status_code == 200
        assert r.json()["status"] == "cleared"
        names = sorted(s["name"] for s in client.get("/signatures").json())
        assert names == ["cg1"]

    def test_clear_chief_guests_keeps_audience(self, client, make_signature):
        self._seed(make_signature)
        r = client.delete("/admin/chief-guest-signatures")
        assert r.status_code == 200
        names = sorted(s["name"] for s in client.get("/signatures").json())
        assert names == ["aud1", "aud2"]


# ───────────────────────── DB listing ──────────────────────────────────

class TestDbListing:
    def test_empty(self, client):
        body = client.get("/admin/db/signatures").json()
        assert body == {"total": 0, "items": []}

    def test_listing_newest_first_with_total(self, client, make_signature):
        storage.add(make_signature(name="old", timestamp=1))
        storage.add(make_signature(name="new", timestamp=2))
        body = client.get("/admin/db/signatures").json()
        assert body["total"] == 2
        assert [i["name"] for i in body["items"]] == ["new", "old"]
        assert "signature" not in body["items"][0]  # no heavy base64 in listing

    def test_pagination(self, client, make_signature):
        for i in range(5):
            storage.add(make_signature(name=f"n{i}", timestamp=i))
        body = client.get("/admin/db/signatures?skip=2&limit=2").json()
        assert body["total"] == 5
        assert [i["name"] for i in body["items"]] == ["n2", "n1"]


# ───────────────────────── update name ─────────────────────────────────

class TestImportSignatures:
    def test_imports_application_json_and_refreshes_store(self, client, make_signature, png_data_url):
        sig = make_signature(name="Imported", signature=png_data_url, timestamp=10)
        r = client.post("/admin/import-signatures", json=[sig.model_dump()])

        assert r.status_code == 200
        assert r.json() == {"status": "imported", "added": 1, "updated": 0, "total": 1}
        body = client.get("/signatures").json()
        assert [s["name"] for s in body] == ["Imported"]
        assert body[0]["signature"] == png_data_url

    def test_import_updates_existing_ids_without_duplicate_rows(self, client, make_signature):
        sig = make_signature(name="Before", timestamp=10)
        storage.add(sig)
        updated = sig.model_copy(update={"name": "After", "timestamp": 20, "is_chief_guest": True})

        r = client.post("/admin/import-signatures", json=[updated.model_dump()])

        assert r.status_code == 200
        assert r.json()["updated"] == 1
        body = client.get("/signatures").json()
        assert len(body) == 1
        assert body[0]["name"] == "After"
        assert body[0]["is_chief_guest"] is True

    def test_import_rejects_non_application_json(self, client):
        assert client.post("/admin/import-signatures", json={"items": []}).status_code == 422


class TestUpdateName:
    def test_update_success(self, client, make_signature):
        sig = make_signature(name="Before")
        storage.add(sig)
        r = client.put(f"/admin/db/signatures/{sig.id}", json={"name": "After"})
        assert r.status_code == 200
        assert storage.get_all()[0].name == "After"

    def test_update_invalid_name_422(self, client, make_signature):
        sig = make_signature(name="Before")
        storage.add(sig)
        assert client.put(f"/admin/db/signatures/{sig.id}", json={"name": "   "}).status_code == 422

    def test_update_missing_404(self, client):
        assert client.put("/admin/db/signatures/nope", json={"name": "X"}).status_code == 404


# ───────────────────────── chief-guest toggle ──────────────────────────

class TestChiefGuestToggle:
    def test_mark_and_unmark(self, client, make_signature):
        sig = make_signature(name="VIP")
        storage.add(sig)
        r = client.put(f"/admin/db/signatures/{sig.id}/chief-guest", json={"is_chief_guest": True})
        assert r.status_code == 200
        assert storage.get_all()[0].is_chief_guest is True
        client.put(f"/admin/db/signatures/{sig.id}/chief-guest", json={"is_chief_guest": False})
        assert storage.get_all()[0].is_chief_guest is False

    def test_missing_404(self, client):
        r = client.put("/admin/db/signatures/nope/chief-guest", json={"is_chief_guest": True})
        assert r.status_code == 404


# ───────────────────────── delete ──────────────────────────────────────

class TestDelete:
    def test_delete_success(self, client, make_signature):
        sig = make_signature(name="Doomed")
        storage.add(sig)
        assert client.delete(f"/admin/db/signatures/{sig.id}").status_code == 200
        assert storage.count() == 0

    def test_delete_missing_404(self, client):
        assert client.delete("/admin/db/signatures/nope").status_code == 404


# ───────────────────────── image download ──────────────────────────────

class TestImageDownload:
    def test_download_png(self, client, make_signature, png_data_url):
        sig = make_signature(name="Img", signature=png_data_url)
        storage.add(sig)
        r = client.get(f"/admin/db/signatures/{sig.id}/image")
        assert r.status_code == 200
        assert r.headers["content-type"] == "image/png"
        assert "attachment" in r.headers["content-disposition"]
        assert r.content[:8] == b"\x89PNG\r\n\x1a\n"

    def test_download_filename_sanitizes_unsafe_name_characters(self, client, make_signature, png_data_url):
        sig = make_signature(name='A/B:C*"D', signature=png_data_url)
        storage.add(sig)
        r = client.get(f"/admin/db/signatures/{sig.id}/image")

        assert r.status_code == 200
        assert 'filename="A_B_C__D_' in r.headers["content-disposition"]

    def test_no_signature_404(self, client, make_signature):
        sig = make_signature(name="NoSig", signature=None)
        storage.add(sig)
        assert client.get(f"/admin/db/signatures/{sig.id}/image").status_code == 404

    def test_missing_id_404(self, client):
        assert client.get("/admin/db/signatures/nope/image").status_code == 404

    def test_malformed_base64_returns_500(self, client, make_signature):
        # Has a comma (so the split succeeds) but an undecodable payload.
        sig = make_signature(name="Bad", signature="data:image/png;base64,AAAAA")
        storage.add(sig)
        assert client.get(f"/admin/db/signatures/{sig.id}/image").status_code == 500


# ───────────────────────── save images to disk ─────────────────────────

class TestSaveImages:
    def test_resaves_missing_files(self, client, make_signature, png_data_url):
        # Add two drawn signatures (written to disk by add()).
        storage.add(make_signature(name="A", signature=png_data_url))
        storage.add(make_signature(name="B", signature=png_data_url))
        # Simulate a restart where the in-memory store survived but disk was wiped.
        shutil.rmtree(paths.SIGNATURES_DIR, ignore_errors=True)

        r = client.post("/admin/save-images")
        assert r.status_code == 200
        body = r.json()
        assert body["newly_saved"] == 2
        assert body["signatures_dir"] == str(paths.SIGNATURES_DIR)
        # folders is a {date: count} map summing to the saved files.
        assert sum(body["folders"].values()) == 2

    def test_nothing_to_save_when_already_on_disk(self, client, make_signature, png_data_url):
        storage.add(make_signature(name="A", signature=png_data_url))
        r = client.post("/admin/save-images")
        assert r.json()["newly_saved"] == 0

    def test_signatureless_entries_not_counted(self, client, make_signature):
        storage.add(make_signature(name="NoSig", signature=None))
        r = client.post("/admin/save-images")
        assert r.json()["newly_saved"] == 0
