-- Baseline for the seven pre-staff-account application tables.
-- IF NOT EXISTS makes this safe to record against the existing Dissertation
-- project, whose original tables predate its recorded migration history.
-- This migration contains schema only; historical restaurant data is not seeded.

CREATE TABLE IF NOT EXISTS public.users (
    id bigserial PRIMARY KEY,
    full_name varchar(100) NOT NULL,
    email varchar(120) NOT NULL UNIQUE,
    password_hash text NOT NULL,
    role varchar(50) NOT NULL DEFAULT 'manager',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bookings (
    id bigserial PRIMARY KEY,
    booking_date date NOT NULL,
    booking_time time,
    party_size integer NOT NULL CHECK (party_size > 0),
    booking_type text NOT NULL CHECK (booking_type IN ('walk_in', 'same_day', 'advance')),
    customer_name text,
    notes text,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.restaurant_demand_features (
    date date,
    same_day_covers bigint,
    walk_in_covers bigint,
    advance_covers bigint,
    total_covers bigint,
    avg_duration_covers_summary bigint,
    advance_bookings bigint,
    same_day_bookings bigint,
    walk_in_bookings bigint,
    total_bookings bigint,
    avg_duration_bookings_summary bigint,
    day_of_week text,
    month bigint,
    week_of_year bigint,
    day_of_month bigint,
    is_weekend bigint
);

CREATE TABLE IF NOT EXISTS public.staff_roles (
    id bigserial PRIMARY KEY,
    role_name varchar(100) NOT NULL,
    department varchar(100) NOT NULL,
    hourly_rate numeric(10, 2) NOT NULL CHECK (hourly_rate >= 0),
    standard_shift_hours numeric(5, 2) NOT NULL CHECK (standard_shift_hours > 0),
    created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.staffing_rules (
    id bigserial PRIMARY KEY,
    min_covers integer NOT NULL CHECK (min_covers >= 0),
    max_covers integer NOT NULL,
    kitchen_staff integer NOT NULL DEFAULT 0 CHECK (kitchen_staff >= 0),
    floor_staff integer NOT NULL DEFAULT 0 CHECK (floor_staff >= 0),
    bar_staff integer NOT NULL DEFAULT 0 CHECK (bar_staff >= 0),
    supervisor_staff integer NOT NULL DEFAULT 0 CHECK (supervisor_staff >= 0),
    created_at timestamp DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT staffing_rules_check CHECK (max_covers >= min_covers)
);

CREATE TABLE IF NOT EXISTS public.staff_cost_forecast (
    id bigserial PRIMARY KEY,
    forecast_date date NOT NULL,
    predicted_covers integer NOT NULL CHECK (predicted_covers >= 0),
    department varchar(100) NOT NULL,
    role_name varchar(100) NOT NULL,
    required_staff integer NOT NULL CHECK (required_staff >= 0),
    hourly_rate numeric(10, 2) NOT NULL CHECK (hourly_rate >= 0),
    shift_hours numeric(5, 2) NOT NULL CHECK (shift_hours >= 0),
    estimated_cost numeric(12, 2) NOT NULL CHECK (estimated_cost >= 0),
    generated_at timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.business_settings (
    id bigserial PRIMARY KEY,
    average_spend_per_cover numeric(10, 2) NOT NULL,
    food_cost_percentage numeric(5, 2) NOT NULL,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

-- Match the live database's server-only tables. There are deliberately no
-- anon/authenticated Data API policies; Flask uses a server-side DB role.
ALTER TABLE public.restaurant_demand_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staffing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_cost_forecast ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

-- The live bookings table currently lacks RLS. Keep this historical baseline
-- faithful to production; remediate that exposure in a separate reviewed
-- security migration after confirming the app's access path.
