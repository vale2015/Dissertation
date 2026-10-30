-- Read-only fingerprint of application-owned table structure. Run this same
-- query on the disposable replay database and the linked Supabase project.
-- Role grants and unrelated Supabase-managed objects are checked separately.
WITH application_tables AS (
    SELECT c.oid, c.relname, c.relrowsecurity, c.relforcerowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relname IN (
          'users', 'bookings', 'restaurant_demand_features', 'staff_roles',
          'staffing_rules', 'staff_cost_forecast', 'business_settings',
          'user_account_tokens', 'staff_account_audit', 'auth_rate_limits',
          'report_history', 'forecast_runs', 'forecast_run_days',
          'active_forecast_run', 'service_actual_covers',
          'service_actual_corrections', 'in_app_notifications'
      )
), snapshot AS (
    SELECT jsonb_agg(jsonb_build_object(
        'table', t.relname,
        'rls', t.relrowsecurity,
        'force_rls', t.relforcerowsecurity,
        'columns', (SELECT jsonb_agg(jsonb_build_object(
            'name', a.attname,
            'type', format_type(a.atttypid, a.atttypmod),
            'not_null', a.attnotnull,
            'identity', a.attidentity,
            'default', pg_get_expr(d.adbin, d.adrelid)
        ) ORDER BY a.attnum)
        FROM pg_attribute a
        LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE a.attrelid = t.oid AND a.attnum > 0 AND NOT a.attisdropped),
        'constraints', (SELECT coalesce(jsonb_agg(jsonb_build_object(
            'name', con.conname, 'definition', pg_get_constraintdef(con.oid, true)
        ) ORDER BY con.conname), '[]'::jsonb)
        FROM pg_constraint con WHERE con.conrelid = t.oid
          AND con.contype <> 'n'), -- PG18 catalogs NOT NULL separately; PG17 does not.
        'indexes', (SELECT coalesce(jsonb_agg(jsonb_build_object(
            'name', ic.relname, 'definition', pg_get_indexdef(i.indexrelid)
        ) ORDER BY ic.relname), '[]'::jsonb)
        FROM pg_index i JOIN pg_class ic ON ic.oid = i.indexrelid
        WHERE i.indrelid = t.oid),
        'policies', (SELECT coalesce(jsonb_agg(jsonb_build_object(
            'name', p.polname, 'command', p.polcmd,
            'using', pg_get_expr(p.polqual, p.polrelid),
            'check', pg_get_expr(p.polwithcheck, p.polrelid)
        ) ORDER BY p.polname), '[]'::jsonb)
        FROM pg_policy p WHERE p.polrelid = t.oid),
        'triggers', (SELECT coalesce(jsonb_agg(jsonb_build_object(
            'name', tr.tgname, 'definition', pg_get_triggerdef(tr.oid)
        ) ORDER BY tr.tgname), '[]'::jsonb)
        FROM pg_trigger tr WHERE tr.tgrelid = t.oid AND NOT tr.tgisinternal)
    ) ORDER BY t.relname) AS catalog
    FROM application_tables t
)
SELECT md5(catalog::text) AS application_schema_fingerprint FROM snapshot;
