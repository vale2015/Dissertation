-- Shared, server-only counters for public authentication endpoints.
-- Keys are HMAC digests; raw email addresses and IP addresses are not stored.
BEGIN;

CREATE TABLE public.auth_rate_limits (
    scope text NOT NULL CHECK (scope IN ('login_email', 'login_ip', 'account_token_ip')),
    key_hash text NOT NULL CHECK (key_hash ~ '^[0-9a-f]{64}$'),
    attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    window_started_at timestamptz NOT NULL DEFAULT now(),
    blocked_until timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (scope, key_hash)
);

CREATE INDEX auth_rate_limits_updated_at_idx ON public.auth_rate_limits (updated_at);
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.auth_rate_limits FROM anon, authenticated;

COMMIT;
