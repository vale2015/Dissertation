# Database migrations

`migrations/` is the ordered, forward-only schema history for the application.
It reconstructs the seven original tables, the two staff-account changes, and
the demand-date primary key already recorded in the live Supabase project.
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
`20260811153749`, and `20261021151713`, but its original tables were created
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
-- Read-only checks: expect 9 application tables, 1 demand-date primary key,
-- and 8 RLS-enabled tables on the current live project.
SELECT count(*) AS application_tables
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relname IN (
    'users', 'bookings', 'restaurant_demand_features', 'staff_roles',
    'staffing_rules', 'staff_cost_forecast', 'business_settings',
    'user_account_tokens', 'staff_account_audit'
  );

SELECT pg_get_constraintdef(oid) AS demand_date_constraint
FROM pg_constraint
WHERE conrelid = 'public.restaurant_demand_features'::regclass
  AND conname = 'restaurant_demand_features_pkey';

SELECT c.relname, c.relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;
```

The live `public.bookings` table currently has RLS disabled, unlike the other
eight tables. This is a security issue for an exposed Supabase schema and
needs a separately reviewed migration after confirming its access pattern.
The baseline mirrors production rather than quietly changing its behavior.
The live database also has an unused `set_guest_minutes()` function with no
trigger; it is not part of the app schema or migration chain.
