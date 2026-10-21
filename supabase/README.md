# Database migrations

`migrations/` is the ordered, forward-only schema history for the application.
It reconstructs the seven original tables, the two staff-account changes, the
demand-date primary key, server-only access control for bookings, and shared
authentication rate-limit counters.
The older `backend/migrations/001_staff_accounts.sql` is a combined manual
script kept for historical reference; do **not** run it in addition to these
timestamped migrations. Its rollback is also manual and is not part of the
forward migration chain.

## Fresh local database

Install the Supabase CLI and Docker, then initialize/link the project using
the [Supabase CLI guide](https://supabase.com/docs/guides/local-development/cli-workflows).
From the repository root, run `supabase db reset` to create the application
schema from scratch. Check `supabase migration list` and run the read-only
verification query below. No production records, users, or passwords are
included in these schema migrations.

## Existing Dissertation Supabase project

The live project already records migrations `20260811153624`,
`20260811153749`, `20261021151713`, `20261021155305`, and `20261021160211`, but its original tables were created
before migration tracking. First verify the live schema against the baseline.
Then use `supabase migration repair --status applied 20260811000000` to record
that baseline **without re-running its SQL**. Confirm the local and remote
versions match with `supabase migration list` and inspect
`supabase db push --dry-run` before any future push. Migration repair changes
history only; it must not be used to conceal a real schema mismatch.

For future changes, generate a new migration with `supabase migration new`,
test on a disposable/local database with `supabase db reset`, review the
advisors, then deploy the migration. Do not edit a migration already applied
to a shared database.

```sql
-- Read-only checks: expect 10 application tables, 1 demand-date primary key,
-- and 10 RLS-enabled tables on the current live project.
SELECT count(*) AS application_tables
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relname IN (
    'users', 'bookings', 'restaurant_demand_features', 'staff_roles',
    'staffing_rules', 'staff_cost_forecast', 'business_settings',
    'user_account_tokens', 'staff_account_audit', 'auth_rate_limits'
  );

SELECT pg_get_constraintdef(oid) AS demand_date_constraint
FROM pg_constraint
WHERE conrelid = 'public.restaurant_demand_features'::regclass
  AND conname = 'restaurant_demand_features_pkey';

SELECT c.relname, c.relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

-- Expect false for both client roles, true for the server role.
SELECT
  has_table_privilege('anon', 'public.bookings', 'SELECT') AS anon_can_read,
  has_table_privilege('authenticated', 'public.bookings', 'SELECT') AS authenticated_can_read,
  has_table_privilege('postgres', 'public.bookings', 'SELECT') AS server_can_read,
  has_sequence_privilege('anon', 'public.bookings_id_seq', 'USAGE') AS anon_sequence_usage;

-- Authentication counters are also server-only.
SELECT
  has_table_privilege('anon', 'public.auth_rate_limits', 'SELECT') AS anon_can_read,
  has_table_privilege('authenticated', 'public.auth_rate_limits', 'SELECT') AS authenticated_can_read,
  has_table_privilege('postgres', 'public.auth_rate_limits', 'SELECT') AS server_can_read;
```

The historical baseline mirrors the earlier database state. The final
`secure_bookings_server_only_access` migration enables RLS and revokes direct
`anon`/`authenticated` table and sequence privileges while retaining the
server-side `postgres` role's access. No Data API policies are needed because
the browser accesses bookings only through Flask.
The live database also has an unused `set_guest_minutes()` function with no
trigger; it is not part of the app schema or migration chain.

`auth_rate_limit_counters` creates a server-only table for hashed login-email,
login-IP, and public token-endpoint counters. It has no browser/Data API policy.
The backend prunes counters older than two days opportunistically.
