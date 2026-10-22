-- Flask uses a direct server-side PostgreSQL connection. Neither anon nor
-- authenticated needs the Supabase Data API for application-owned objects.
-- Keep postgres and service_role grants intact for server-side operations.
BEGIN;

REVOKE ALL PRIVILEGES ON TABLE
    public.users,
    public.bookings,
    public.restaurant_demand_features,
    public.staff_roles,
    public.staffing_rules,
    public.staff_cost_forecast,
    public.business_settings,
    public.user_account_tokens,
    public.staff_account_audit,
    public.auth_rate_limits
FROM anon, authenticated;

REVOKE ALL PRIVILEGES ON SEQUENCE
    public.users_id_seq,
    public.bookings_id_seq,
    public.staff_roles_id_seq,
    public.staffing_rules_id_seq,
    public.staff_cost_forecast_id_seq,
    public.business_settings_id_seq,
    public.user_account_tokens_id_seq,
    public.staff_account_audit_id_seq
FROM anon, authenticated;

-- This historical trigger function has no attached trigger and is not used by
-- the app. Trigger functions cannot be called as normal RPCs, but retaining
-- their default PUBLIC EXECUTE grant is unnecessary.
DO $$
BEGIN
    IF to_regprocedure('public.set_guest_minutes()') IS NOT NULL THEN
        EXECUTE 'REVOKE EXECUTE ON FUNCTION public.set_guest_minutes() '
             || 'FROM PUBLIC, anon, authenticated';
    END IF;
END $$;

-- Future objects created by application migrations under postgres must opt in
-- explicitly before client roles can reach them through the Data API.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
    REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

COMMIT;
