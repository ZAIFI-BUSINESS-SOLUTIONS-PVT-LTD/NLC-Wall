"""Unit tests for the Pydantic models in models.py — field validation, clamping,
trimming and the constraints that protect the API surface."""

import pytest
from pydantic import ValidationError

from models import (
    SubmitRequest,
    Signature,
    SubmitResponse,
    HealthResponse,
    ThemeBody,
    UpdateNameBody,
    PledgeConfigBody,
    ChiefGuestConfigBody,
    ChiefGuestMarkBody,
)


# ───────────────────────── SubmitRequest.name ──────────────────────────

class TestSubmitRequestName:
    def test_valid_name_passes(self):
        req = SubmitRequest(name="Rishi")
        assert req.name == "Rishi"
        assert req.signature is None

    def test_name_is_trimmed(self):
        assert SubmitRequest(name="   Rishi   ").name == "Rishi"

    def test_empty_name_rejected(self):
        with pytest.raises(ValidationError):
            SubmitRequest(name="")

    def test_whitespace_only_name_rejected(self):
        with pytest.raises(ValidationError):
            SubmitRequest(name="     ")

    def test_name_at_max_length_60_passes(self):
        name = "A" * 60
        assert SubmitRequest(name=name).name == name

    def test_name_over_60_rejected(self):
        with pytest.raises(ValidationError):
            SubmitRequest(name="A" * 61)

    def test_name_trimmed_then_measured_for_length(self):
        # 60 visible chars + surrounding spaces should pass (trim happens first).
        assert SubmitRequest(name="  " + "B" * 60 + "  ").name == "B" * 60

    def test_unicode_tamil_name_allowed(self):
        tamil = "மணிகண்டன்"
        assert SubmitRequest(name=tamil).name == tamil

    def test_missing_name_field_rejected(self):
        with pytest.raises(ValidationError):
            SubmitRequest()  # type: ignore[call-arg]


# ───────────────────────── SubmitRequest.signature ─────────────────────

class TestSubmitRequestSignature:
    def test_signature_none_ok(self):
        assert SubmitRequest(name="x", signature=None).signature is None

    def test_signature_small_ok(self):
        data = "data:image/png;base64,AAAA"
        assert SubmitRequest(name="x", signature=data).signature == data

    def test_signature_at_limit_ok(self):
        data = "d" * 200_000
        assert SubmitRequest(name="x", signature=data).signature == data

    def test_signature_over_limit_rejected(self):
        with pytest.raises(ValidationError):
            SubmitRequest(name="x", signature="d" * 200_001)


# ───────────────────────── Signature model ─────────────────────────────

class TestSignature:
    def test_defaults(self):
        sig = Signature(id="abc", name="x", timestamp=123)
        assert sig.signature is None
        assert sig.is_chief_guest is False

    def test_model_dump_round_trip(self):
        sig = Signature(id="abc", name="x", timestamp=1, signature="s", is_chief_guest=True)
        d = sig.model_dump()
        assert d == {
            "id": "abc",
            "name": "x",
            "signature": "s",
            "timestamp": 1,
            "is_chief_guest": True,
        }


# ───────────────────────── Misc small models ───────────────────────────

class TestSimpleModels:
    def test_submit_response(self):
        r = SubmitResponse(id="u", timestamp=99)
        assert r.id == "u" and r.timestamp == 99

    def test_health_response_defaults(self):
        h = HealthResponse(status="ok", count=3)
        assert h.audience_count == 0 and h.cg_count == 0

    def test_theme_body(self):
        assert ThemeBody(theme="space").theme == "space"

    def test_chief_guest_mark_body(self):
        assert ChiefGuestMarkBody(is_chief_guest=True).is_chief_guest is True


# ───────────────────────── UpdateNameBody ──────────────────────────────

class TestUpdateNameBody:
    def test_valid(self):
        assert UpdateNameBody(name="  New  ").name == "New"

    def test_empty_rejected(self):
        with pytest.raises(ValidationError):
            UpdateNameBody(name="   ")

    def test_too_long_rejected(self):
        with pytest.raises(ValidationError):
            UpdateNameBody(name="z" * 61)


# ───────────────────────── PledgeConfigBody ────────────────────────────

class TestPledgeConfigBody:
    def test_defaults(self):
        body = PledgeConfigBody()
        assert body.tamil == "" and body.hindi == "" and body.english == ""
        assert body.duration_seconds == 90

    def test_text_is_trimmed(self):
        body = PledgeConfigBody(tamil="  hello  ")
        assert body.tamil == "hello"

    def test_text_truncated_to_4000(self):
        body = PledgeConfigBody(english="e" * 5000)
        assert len(body.english) == 4000

    def test_duration_clamped_low(self):
        assert PledgeConfigBody(duration_seconds=1).duration_seconds == 5

    def test_duration_clamped_high(self):
        assert PledgeConfigBody(duration_seconds=99999).duration_seconds == 600

    def test_duration_within_range_untouched(self):
        assert PledgeConfigBody(duration_seconds=42).duration_seconds == 42

    def test_duration_negative_clamped_to_min(self):
        assert PledgeConfigBody(duration_seconds=-10).duration_seconds == 5


# ───────────────────────── ChiefGuestConfigBody ────────────────────────

class TestChiefGuestConfigBody:
    def test_forever_mode(self):
        b = ChiefGuestConfigBody(enabled=True, retention_mode="forever")
        assert b.retention_mode == "forever"
        assert b.retention_until is None

    def test_until_datetime_mode(self):
        b = ChiefGuestConfigBody(
            enabled=False, retention_mode="until_datetime", retention_until=1_700_000_000_000
        )
        assert b.retention_until == 1_700_000_000_000

    def test_invalid_mode_rejected(self):
        with pytest.raises(ValidationError):
            ChiefGuestConfigBody(enabled=True, retention_mode="someday")

    def test_enabled_required(self):
        with pytest.raises(ValidationError):
            ChiefGuestConfigBody(retention_mode="forever")  # type: ignore[call-arg]
