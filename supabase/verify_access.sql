-- Read-only task-4 access checks. A failed assertion stops psql in CI.
DO $$
DECLARE
    application_tables text[] := ARRAY[
        'users', 'bookings', 'restaurant_demand_features', 'staff_roles',
        'staffing_rules', 'staff_cost_forecast', 'business_settings',
        'user_account_tokens', 'staff_account_audit', 'auth_rate_limits'
    ];
    application_sequences text[] := ARRAY[
        'users_id_seq', 'bookings_id_seq', 'staff_roles_id_seq',
        'staffing_rules_id_seq', 'staff_cost_forecast_id_seq',
        'business_settings_id_seq', 'user_account_tokens_id_seq',
        'staff_account_audit_id_seq'
    ];
BEGIN
    IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
          AND c.relname = ANY(application_tables)) <> 10 THEN
        RAISE EXCEPTION 'Expected ten application tables';
    END IF;
    IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'S'
          AND c.relname = ANY(application_sequences)) <> 8 THEN
        RAISE EXCEPTION 'Expected eight application sequences';
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        CROSS JOIN (VALUES ('anon'::name), ('authenticated'::name)) AS role_name(name)
        CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
            ('TRUNCATE'), ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')) AS privilege(name)
        WHERE n.nspname = 'public' AND c.relkind = 'r'
          AND c.relname = ANY(application_tables)
          AND has_table_privilege(role_name.name, c.oid, privilege.name)
    ) THEN
        RAISE EXCEPTION 'Client role retains an application-table privilege';
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        CROSS JOIN (VALUES ('anon'::name), ('authenticated'::name)) AS role_name(name)
        CROSS JOIN (VALUES ('USAGE'), ('SELECT'), ('UPDATE')) AS privilege(name)
        WHERE n.nspname = 'public' AND c.relkind = 'S'
          AND c.relname = ANY(application_sequences)
          AND has_sequence_privilege(role_name.name, c.oid, privilege.name)
    ) THEN
        RAISE EXCEPTION 'Client role retains an application-sequence privilege';
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND (has_function_privilege('anon', p.oid, 'EXECUTE')
            OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
    ) THEN
        RAISE EXCEPTION 'Client role retains a public-function privilege';
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_default_acl d
        CROSS JOIN LATERAL aclexplode(d.defaclacl) a
        WHERE d.defaclrole = 'postgres'::regrole
          AND (d.defaclnamespace = 'public'::regnamespace
            OR d.defaclnamespace = 0)
          AND (a.grantee = 0 OR a.grantee IN
            ('anon'::regrole, 'authenticated'::regrole))
    ) THEN
        RAISE EXCEPTION 'postgres still auto-grants a client privilege';
    END IF;
    IF NOT has_table_privilege('postgres', 'public.users', 'SELECT')
      OR NOT has_table_privilege('service_role', 'public.users', 'SELECT')
      OR NOT has_sequence_privilege('postgres', 'public.users_id_seq', 'USAGE')
      OR NOT has_sequence_privilege('service_role', 'public.users_id_seq', 'USAGE') THEN
        RAISE EXCEPTION 'Server-side access was unexpectedly removed';
    END IF;
END $$;
