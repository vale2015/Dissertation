-- The browser talks to Flask, which uses a server-side Postgres connection.
-- No client role needs direct access to bookings through the Supabase Data API.
BEGIN;

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.bookings FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE public.bookings_id_seq FROM anon, authenticated;

COMMIT;
