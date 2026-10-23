# Database migrations

`migrations/` is the ordered, forward-only schema history for the application.
It reconstructs the seven original tables, the two staff-account changes, the
demand-date primary key, server-only access control for bookings, shared
authentication rate-limit counters, and server-only access for all application
tables and sequences.
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

The live project's original tables were created before migration tracking.
On 2026-10-22, the missing baseline version `20260811000000` was recorded in
`supabase_migrations.schema_migrations` after the application-table schema
fingerprint matched a fresh replay of all six migration files. No baseline SQL
was rerun on the live database. The baseline reconciliation confirmed all six
versions at that point. A seventh access-control migration was applied to the
live project on 2026-10-22, and its history now records seven ordered versions.
Before any future push, confirm the local and remote versions match with
`supabase migration list` and inspect `supabase db push --dry-run`.

### Baseline reconciliation evidence (2026-10-22)

A disposable PGlite/PostgreSQL 17.5 runtime replayed the six SQL files from an
empty database; a separate PostgreSQL 18 replay also passed. The PostgreSQL 17
replay produced all ten application tables with RLS enabled. The
read-only [schema snapshot](schema_snapshot.sql) produced the same normalized
fingerprint on the replay database and the live PostgreSQL 17 project:
`04d4ff8e7f049068d9f4acb0b4312c5f`. This covers application-table
columns, defaults, constraints, indexes, RLS, policies, and triggers; it
excludes role grants and unrelated Supabase-managed objects. A separate live
privilege check confirmed that `bookings` and `auth_rate_limits` have no
`anon`/`authenticated` SELECT privilege. The other eight tables still had
client grants at that time; the seventh migration removed them under item 4.

The migration-history insert was conditional on that live fingerprint, all ten
application tables, all five later migration versions, and absence of the
baseline row. A subsequent read confirmed all six ordered versions. The
GitHub [migration replay workflow](../.github/workflows/migration-replay.yml)
was introduced in `4365f46`. Its first
[run](https://github.com/vale2015/Dissertation/actions/runs/39799268212)
never started a runner because of a GitHub account billing lock. On 2026-10-22,
the CLI migration list matched all seven applied
versions and `db push --dry-run --skip-vault --project-ref szvihzuaybmqkxwkoyli`
reported only `20261022161025_report_history.sql` pending, without applying it.
The local Supabase CLI/Docker stack remains unavailable here. Do not mistake
the embedded PostgreSQL check or GitHub's PostgreSQL-container replay for a
full Supabase-stack reset. Before future migrations, run both the replay and
dry-run gates again against the proposed change.

A rerun of [workflow 39803299668](https://github.com/vale2015/Dissertation/actions/runs/39803299668)
on 2026-10-22 again failed before a runner started; GitHub still reported an
account billing lock. The CLI dry-run passed, but the workflow gate did not.

On 2026-10-23, [main replay 39816288254](https://github.com/vale2015/Dissertation/actions/runs/39816288254)
passed on its third attempt. The report-history branch's
[replay 39930072476](https://github.com/vale2015/Dissertation/actions/runs/39930072476)
passed with the eighth migration and expanded privilege checks. A repeat CLI
list and dry-run showed seven matching applied versions and only that migration
pending. A later read-only live check found version `20261022161025` recorded
and `public.report_history` present; this work session did not run `db push`.
Live checks confirmed RLS enabled, no client policies, no effective
`anon`/`authenticated` table DML or sequence usage, and retained `postgres`
table access. The official local Supabase-stack reset is still outstanding.

For an official full-stack verification when Docker and the CLI are available:
run **local** `supabase db reset` (never `--linked`), compare the resulting
schema, inspect `supabase migration list`, and run `supabase db push --dry-run`.
Never run `db reset --linked` against the live project.

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

The historical baseline mirrors the earlier database state. The earlier
`secure_bookings_server_only_access` migration enables RLS and revokes direct
`anon`/`authenticated` table and sequence privileges while retaining the
server-side `postgres` role's access. No Data API policies are needed because
the browser accesses bookings only through Flask.
The live database also has an unused `set_guest_minutes()` function with no
trigger; it is not part of the app schema or migration chain. The seventh
migration revokes its client execution privilege if it exists.

## Application access verification (2026-10-22)

The seventh migration, `restrict_public_application_access`, was applied to
the live Supabase project. It removes `anon` and `authenticated` privileges
from all ten application tables and eight sequences. No browser access to
these objects through the Data API is intended; Flask uses the direct
server-side `postgres` connection. It also removes client grants from future
objects created by the `postgres` role. The read-only
[`verify_access.sql`](verify_access.sql) check passed on live Supabase and a
disposable PostgreSQL 17.5 replay. Live `SET LOCAL ROLE` checks confirmed that
both client roles receive permission denied (`42501`) when selecting an
application table; `postgres` and `service_role` retained access.

The platform-managed `supabase_admin` role still has default grants that can
expose **new** public objects to client roles. The connected `postgres` role
cannot change those defaults. Before treating item 4 as complete, verify and
disable the project's “Automatically expose new tables/functions” Data API
setting in Supabase, or otherwise remove those platform grants, then create a
disposable object to verify it has no client privileges. This is distinct from
the already-restricted existing application objects. The GitHub replay job
passed on 2026-10-23; that does not resolve the platform-managed future-object
default-grant issue.

`auth_rate_limit_counters` creates a server-only table for hashed login-email,
login-IP, and public token-endpoint counters. It has no browser/Data API policy.
The backend prunes counters older than two days opportunistically.
