-- Server-only, short-lived staff-chat drafts. Confirmed writes and their
-- outcome are recorded in the same transaction for retry-safe execution.
BEGIN;

ALTER TABLE public.auth_rate_limits DROP CONSTRAINT auth_rate_limits_scope_check;
ALTER TABLE public.auth_rate_limits ADD CONSTRAINT auth_rate_limits_scope_check
    CHECK (scope IN ('login_email', 'login_ip', 'account_token_ip',
                    'staff_chat_actor', 'chat_model_actor_minute',
                    'chat_model_actor_day', 'chat_model_global_day'));

CREATE TABLE public.staff_chat_actions (
    id uuid PRIMARY KEY,
    actor_user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('register', 'edit')),
    state text NOT NULL CHECK (state IN ('draft', 'review', 'completed', 'cancelled', 'expired')),
    target_user_id bigint REFERENCES public.users(id) ON DELETE SET NULL,
    draft jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(draft) = 'object'),
    before_snapshot jsonb CHECK (before_snapshot IS NULL OR jsonb_typeof(before_snapshot) = 'object'),
    after_snapshot jsonb CHECK (after_snapshot IS NULL OR jsonb_typeof(after_snapshot) = 'object'),
    expected_updated_at timestamptz,
    revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
    result_user_id bigint REFERENCES public.users(id) ON DELETE SET NULL,
    result_snapshot jsonb CHECK (result_snapshot IS NULL OR jsonb_typeof(result_snapshot) = 'object'),
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
    completed_at timestamptz,
    CHECK (expires_at > created_at),
    CHECK (octet_length(draft::text) <= 2048),
    CHECK (draft - ARRAY['full_name','email','application_role','staff_role_id']::text[] = '{}'::jsonb),
    -- Edit creation requires an existing target in the service. A later hard
    -- deletion may clear its FK while the completed receipt remains usable.
    CHECK (kind <> 'register' OR target_user_id IS NULL),
    CHECK ((state = 'completed') = (completed_at IS NOT NULL)),
    CHECK ((state = 'completed') = (result_snapshot IS NOT NULL)),
    CHECK (state <> 'review' OR after_snapshot IS NOT NULL)
);

CREATE UNIQUE INDEX staff_chat_actions_one_active_per_actor
    ON public.staff_chat_actions (actor_user_id)
    WHERE state IN ('draft', 'review');
CREATE INDEX staff_chat_actions_expiry_idx
    ON public.staff_chat_actions (expires_at);

ALTER TABLE public.staff_chat_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.staff_chat_actions FROM PUBLIC, anon, authenticated;

COMMIT;
