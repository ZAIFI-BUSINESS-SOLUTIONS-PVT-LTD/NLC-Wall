import time
import threading
from collections import defaultdict
from typing import Dict, List, Tuple

# Configurable blocklist — extend as needed
PROFANITY_BLOCKLIST = {
    "fuck", "shit", "bastard", "bitch", "asshole", "damn", "crap",
    # Tamil transliteration common abuses (minimal set)
    "otha", "thevdiya", "punda", "sunni", "koothi",
}

_ip_timestamps: Dict[str, List[float]] = defaultdict(list)
_recent_names: List[Tuple[str, float]] = []
_lock = threading.Lock()

RATE_LIMIT_COUNT = 5
RATE_LIMIT_WINDOW = 60.0   # seconds
DUPLICATE_WINDOW = 60.0    # seconds


def _cleanup(now: float) -> None:
    global _recent_names
    _recent_names = [(n, t) for n, t in _recent_names if now - t < DUPLICATE_WINDOW]


def check_rate_limit(ip: str) -> bool:
    """Return True if allowed, False if rate-limited."""
    now = time.time()
    with _lock:
        timestamps = _ip_timestamps[ip]
        timestamps[:] = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW]
        if len(timestamps) >= RATE_LIMIT_COUNT:
            return False
        timestamps.append(now)
        return True


def check_duplicate(name: str) -> bool:
    """Return True if name is a duplicate within window."""
    now = time.time()
    with _lock:
        _cleanup(now)
        key = name.strip().lower()
        for n, _ in _recent_names:
            if n == key:
                return True
        _recent_names.append((key, now))
        return False


def check_profanity(name: str) -> bool:
    """Return True if profanity detected."""
    lowered = name.lower()
    for word in PROFANITY_BLOCKLIST:
        if word in lowered:
            return True
    return False
