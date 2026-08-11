-- Rollback removes staff-account metadata and token tables. Audit history is
-- retained by default for accountability; drop it manually only if approved.
-- RLS remains enabled on public.users because disabling it would weaken the
-- pre-migration database security posture.
BEGIN;
DROP TABLE IF EXISTS public.user_account_tokens;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_invited_by_fk;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_staff_role_fk;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_session_version_check;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
DROP INDEX IF EXISTS public.users_email_lower_uidx;
DROP INDEX IF EXISTS public.users_status_idx;
DROP INDEX IF EXISTS public.users_role_idx;
DROP INDEX IF EXISTS public.users_staff_role_id_idx;
DROP INDEX IF EXISTS public.users_invited_by_idx;
ALTER TABLE public.users DROP COLUMN IF EXISTS session_version;
ALTER TABLE public.users DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.users DROP COLUMN IF EXISTS last_login_at;
ALTER TABLE public.users DROP COLUMN IF EXISTS activated_at;
ALTER TABLE public.users DROP COLUMN IF EXISTS invited_at;
ALTER TABLE public.users DROP COLUMN IF EXISTS invited_by;
ALTER TABLE public.users DROP COLUMN IF EXISTS staff_role_id;
ALTER TABLE public.users DROP COLUMN IF EXISTS status;
COMMIT;
