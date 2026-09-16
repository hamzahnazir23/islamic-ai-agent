import os
import threading
import time
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import HTTPException, Request

# Two tiers: a burst window stops hammering, a daily cap bounds the
# worst-case bill from a slow, patient scraper.
PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "10"))
PER_DAY = int(os.getenv("RATE_LIMIT_PER_DAY", "200"))

# Railway terminates TLS at its proxy, so request.client.host is the
# proxy. X-Forwarded-For is only trustworthy when a proxy we control
# rewrites it — off by default so it cannot be spoofed in local runs.
TRUST_PROXY = os.getenv("TRUST_PROXY", "false").lower() == "true"

# Login is brute-forceable in a way that /ask is not, so it gets its own
# tighter budget keyed by IP *and* the email being tried: one attacker
# cannot lock every account, and one victim's account cannot be hammered
# from a single address.
LOGIN_PER_15_MIN = int(os.getenv("LOGIN_RATE_LIMIT", "5"))

MINUTE = 60
QUARTER_HOUR = 900
DAY = 86400

_hits: Dict[str, Deque[float]] = defaultdict(deque)
_lock = threading.Lock()


def client_ip(request: Request) -> str:
    if TRUST_PROXY:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            # Left-most entry is the original client.
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _prune(bucket: Deque[float], now: float) -> None:
    cutoff = now - DAY
    while bucket and bucket[0] < cutoff:
        bucket.popleft()


def enforce_rate_limit(request: Request) -> None:
    """
    FastAPI dependency. Raises 429 once a caller exceeds either tier.

    In-memory and per-process: it resets on restart and does not
    coordinate across replicas. That is enough to stop casual abuse of a
    single-instance deploy; a multi-replica setup needs Redis.
    """
    now = time.time()
    ip = client_ip(request)

    with _lock:
        bucket = _hits[ip]
        _prune(bucket, now)

        recent = sum(1 for t in bucket if t >= now - MINUTE)
        if recent >= PER_MINUTE:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please wait a moment.",
                headers={"Retry-After": str(MINUTE)},
            )

        if len(bucket) >= PER_DAY:
            raise HTTPException(
                status_code=429,
                detail="Daily request limit reached. Please try again tomorrow.",
                headers={"Retry-After": str(DAY)},
            )

        bucket.append(now)

        # Keep the table from growing without bound on a long-lived process.
        if len(_hits) > 10_000:
            for key in [k for k, v in _hits.items() if not v]:
                del _hits[key]


_login_hits: Dict[str, Deque[float]] = defaultdict(deque)


def enforce_login_rate_limit(request: Request, email: str) -> None:
    """
    Called from the login handler rather than as a dependency, because the
    key depends on the request body.
    """
    now = time.time()
    key = f"{client_ip(request)}|{email.strip().lower()}"

    with _lock:
        bucket = _login_hits[key]
        while bucket and bucket[0] < now - QUARTER_HOUR:
            bucket.popleft()

        if len(bucket) >= LOGIN_PER_15_MIN:
            raise HTTPException(
                status_code=429,
                detail="Too many login attempts. Please try again later.",
                headers={"Retry-After": str(QUARTER_HOUR)},
            )

        bucket.append(now)


def clear_login_attempts(request: Request, email: str) -> None:
    """A successful login forgives the failures that preceded it."""
    key = f"{client_ip(request)}|{email.strip().lower()}"
    with _lock:
        _login_hits.pop(key, None)


def _reset_all():
    """Test helper: drop every counter between cases."""
    with _lock:
        _hits.clear()
        _login_hits.clear()
