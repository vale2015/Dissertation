-- Reconstructed from the migration recorded on the live Supabase project.
BEGIN;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_account_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_account_audit ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS users_invited_by_idx ON public.users(invited_by);
CREATE INDEX IF NOT EXISTS user_account_tokens_created_by_idx ON public.user_account_tokens(created_by);

COMMIT;
