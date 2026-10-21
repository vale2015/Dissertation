"""Shared PostgreSQL throttling for public authentication endpoints."""

import hashlib
import hmac
import ipaddress
import logging
import math
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from app.db.dbcon import SessionLocal
from app.services.auth_service import get_secret_key


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class LimitPolicy:
    scope: str
    allowed_attempts: int
    window_seconds: int
    initial_block_seconds: int
    max_block_seconds: int


LOGIN_EMAIL = LimitPolicy("login_email", 5, 900, 30, 900)
# This is the backend-observed source IP, not a client-supplied forwarding
# header. Next.js server-side requests may share an outbound address, so these
# limits are deliberately high; the normalized email limit is the main defense.
LOGIN_IP = LimitPolicy("login_ip", 1000, 600, 60, 600)
ACCOUNT_TOKEN_IP = LimitPolicy("account_token_ip", 1000, 600, 60, 600)


RESERVE_SQL = text("""
    INSERT INTO public.auth_rate_limits AS limits
        (scope, key_hash, attempt_count, window_started_at, updated_at)
    VALUES (:scope, :key_hash, 1, :now, :now)
    ON CONFLICT (scope, key_hash) DO UPDATE SET
        attempt_count = CASE
            WHEN limits.blocked_until > :now THEN limits.attempt_count
            WHEN limits.window_started_at <= :now - make_interval(secs => :window_seconds) THEN 1
            ELSE limits.attempt_count + 1
        END,
        window_started_at = CASE
            WHEN limits.blocked_until > :now THEN limits.window_started_at
            WHEN limits.window_started_at <= :now - make_interval(secs => :window_seconds) THEN :now
            ELSE limits.window_started_at
        END,
        blocked_until = CASE
            WHEN limits.blocked_until > :now THEN limits.blocked_until
            WHEN limits.window_started_at <= :now - make_interval(secs => :window_seconds) THEN NULL
            ELSE limits.blocked_until
        END,
        updated_at = :now
    RETURNING attempt_count, blocked_until
""")


def _key_hash(scope, value):
    payload = f"{scope}\x00{value}".encode("utf-8")
    return hmac.new(get_secret_key().encode("utf-8"), payload, hashlib.sha256).hexdigest()


def _source_ip(address):
    try:
        return str(ipaddress.ip_address(address or ""))
    except ValueError:
        return "unknown"


def _block_seconds(policy, excess_attempts):
    # Cap the exponent before shifting to avoid huge integers under abuse.
    exponent = min(max(excess_attempts - 1, 0), 10)
    return min(policy.initial_block_seconds * (2 ** exponent), policy.max_block_seconds)


def _reserve(db, policy, value, now):
    key_hash = _key_hash(policy.scope, value)
    row = db.execute(
        RESERVE_SQL,
        {
            "scope": policy.scope,
            "key_hash": key_hash,
            "window_seconds": policy.window_seconds,
            "now": now,
        },
    ).mappings().one()

    blocked_until = row["blocked_until"]
    if blocked_until and blocked_until > now:
        return max(1, math.ceil((blocked_until - now).total_seconds()))

    excess = row["attempt_count"] - policy.allowed_attempts
    if excess <= 0:
        return 0

    retry_after = _block_seconds(policy, excess)
    db.execute(
        text("""
            UPDATE public.auth_rate_limits
            SET blocked_until = :blocked_until
            WHERE scope = :scope AND key_hash = :key_hash
        """),
        {
            "scope": policy.scope,
            "key_hash": key_hash,
            "blocked_until": now + timedelta(seconds=retry_after),
        },
    )
    logger.warning("Authentication request throttled for %s scope.", policy.scope)
    return retry_after


def _maybe_prune(db, now):
    # Opportunistic cleanup bounds table growth without a serverless timer.
    if secrets.randbelow(128) == 0:
        db.execute(
            text("DELETE FROM public.auth_rate_limits WHERE updated_at < :cutoff"),
            {"cutoff": now - timedelta(days=2)},
        )


def reserve_login_attempt(email, remote_address):
    """Return a Retry-After duration, or zero when login may proceed."""
    now = datetime.now(timezone.utc)
    normalized_email = email.strip().lower()
    with SessionLocal.begin() as db:
        retry_after = _reserve(db, LOGIN_IP, _source_ip(remote_address), now)
        if not retry_after:
            retry_after = _reserve(db, LOGIN_EMAIL, normalized_email, now)
        _maybe_prune(db, now)
    return retry_after


def clear_login_email(email):
    """A successful login resets this account's temporary failure window."""
    with SessionLocal.begin() as db:
        db.execute(
            text("""
                DELETE FROM public.auth_rate_limits
                WHERE scope = 'login_email' AND key_hash = :key_hash
            """),
            {"key_hash": _key_hash("login_email", email.strip().lower())},
        )


def reserve_account_token_attempt(remote_address):
    now = datetime.now(timezone.utc)
    with SessionLocal.begin() as db:
        retry_after = _reserve(db, ACCOUNT_TOKEN_IP, _source_ip(remote_address), now)
        _maybe_prune(db, now)
    return retry_after
