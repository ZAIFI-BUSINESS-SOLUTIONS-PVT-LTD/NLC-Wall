"""Unit tests for moderation.py — rate limiting, profanity blocklist, and the
short-window duplicate guard. A controllable fake clock lets us test the
time-based windows without real sleeps."""

import pytest

import moderation


@pytest.fixture
def fake_clock(monkeypatch):
    """Replace time.time() inside moderation with a clock we advance manually."""
    state = {"now": 1_000_000.0}

    def _now():
        return state["now"]

    monkeypatch.setattr(moderation.time, "time", _now)

    def advance(seconds):
        state["now"] += seconds

    advance.set = lambda v: state.__setitem__("now", v)  # type: ignore[attr-defined]
    return advance


# ───────────────────────── Profanity ───────────────────────────────────

class TestProfanity:
    def test_clean_name_passes(self):
        assert moderation.check_profanity("Rishi Kumar") is False

    def test_tamil_name_passes(self):
        assert moderation.check_profanity("மணிகண்டன்") is False

    @pytest.mark.parametrize("word", sorted(moderation.PROFANITY_BLOCKLIST))
    def test_each_blocklisted_word_detected(self, word):
        assert moderation.check_profanity(word) is True

    def test_detection_is_case_insensitive(self):
        assert moderation.check_profanity("ShIt") is True

    def test_detection_within_sentence(self):
        assert moderation.check_profanity("you are a bastard") is True

    def test_known_substring_false_positive_is_documented(self):
        # "crap" is in the blocklist and matching is substring-based, so words
        # like "scrapbook" are (intentionally noted) caught. This guards the
        # current behaviour so a future change is a conscious decision.
        assert moderation.check_profanity("scrapbook") is True


# ───────────────────────── Rate limiting ───────────────────────────────

class TestRateLimit:
    def test_allows_up_to_the_limit(self, fake_clock):
        ip = "10.0.0.1"
        for _ in range(moderation.RATE_LIMIT_COUNT):
            assert moderation.check_rate_limit(ip) is True

    def test_blocks_after_limit(self, fake_clock):
        ip = "10.0.0.2"
        for _ in range(moderation.RATE_LIMIT_COUNT):
            assert moderation.check_rate_limit(ip) is True
        # The (limit + 1)th request in the same window is blocked.
        assert moderation.check_rate_limit(ip) is False

    def test_limit_is_per_ip(self, fake_clock):
        for _ in range(moderation.RATE_LIMIT_COUNT):
            moderation.check_rate_limit("1.1.1.1")
        assert moderation.check_rate_limit("1.1.1.1") is False
        # A different device/IP is unaffected.
        assert moderation.check_rate_limit("2.2.2.2") is True

    def test_window_expiry_frees_the_quota(self, fake_clock):
        ip = "3.3.3.3"
        for _ in range(moderation.RATE_LIMIT_COUNT):
            assert moderation.check_rate_limit(ip) is True
        assert moderation.check_rate_limit(ip) is False
        # Advance past the rolling window — old timestamps are pruned.
        fake_clock(moderation.RATE_LIMIT_WINDOW + 1)
        assert moderation.check_rate_limit(ip) is True

    def test_partial_window_slide(self, fake_clock):
        ip = "4.4.4.4"
        # Use up the quota at t0.
        for _ in range(moderation.RATE_LIMIT_COUNT):
            moderation.check_rate_limit(ip)
        # Half a window later, still blocked (none expired yet).
        fake_clock(moderation.RATE_LIMIT_WINDOW / 2)
        assert moderation.check_rate_limit(ip) is False


# ───────────────────────── Duplicate guard ─────────────────────────────

class TestDuplicate:
    def test_first_submission_not_duplicate(self, fake_clock):
        assert moderation.check_duplicate("Rishi") is False

    def test_immediate_repeat_is_duplicate(self, fake_clock):
        assert moderation.check_duplicate("Rishi") is False
        assert moderation.check_duplicate("Rishi") is True

    def test_different_name_not_duplicate(self, fake_clock):
        moderation.check_duplicate("Alice")
        assert moderation.check_duplicate("Bob") is False

    def test_match_is_case_insensitive_and_trimmed(self, fake_clock):
        assert moderation.check_duplicate("Rishi") is False
        assert moderation.check_duplicate("  rIsHi  ") is True

    def test_duplicate_expires_after_window(self, fake_clock):
        assert moderation.check_duplicate("Rishi") is False
        # Just inside the window — still a duplicate.
        fake_clock(moderation.DUPLICATE_WINDOW - 1)
        assert moderation.check_duplicate("Rishi") is True
        # Past the window — the earlier entry is cleaned up.
        fake_clock(moderation.DUPLICATE_WINDOW + 1)
        assert moderation.check_duplicate("Rishi") is False

    def test_same_name_second_person_allowed_after_window(self, fake_clock):
        # The window is deliberately short so a genuinely different visitor with
        # the same common name is not blocked for long.
        assert moderation.DUPLICATE_WINDOW <= 30
