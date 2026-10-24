-- One-time, manual production demo fixture for forecast accuracy (#21).
-- Run only against the intended Dissertation Supabase project after the
-- application supports dataset=demo. Never include this in migration replay
-- or automatic seeding. The forecast run is immutable by design.
-- Re-running this block is a no-op; it never resets manager-entered changes.
DO $$
DECLARE
    demo_run_id bigint;
BEGIN
    SELECT id INTO demo_run_id
    FROM public.forecast_runs
    WHERE model_name = 'accuracy_demo_fixture'
      AND model_version = 'demo-seed-2026-10-24-v1'
      AND selected_date = DATE '2026-10-16';
    IF demo_run_id IS NOT NULL THEN
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.forecast_run_days
        WHERE forecast_date BETWEEN DATE '2026-10-17' AND DATE '2026-10-23'
    ) OR EXISTS (
        SELECT 1 FROM public.service_actual_covers
        WHERE service_date BETWEEN DATE '2026-10-17' AND DATE '2026-10-23'
    ) THEN
        RAISE EXCEPTION 'Demo dates overlap existing forecast or actual records';
    END IF;

    INSERT INTO public.forecast_runs (
        selected_date, days_ahead, model_name, model_version, prediction
    ) VALUES (
        DATE '2026-10-16', 7, 'accuracy_demo_fixture',
        'demo-seed-2026-10-24-v1',
        jsonb_build_object(
            'demo', true,
            'note', 'Illustrative predictions created after the service dates; not a real historical forecast'
        )
    ) RETURNING id INTO demo_run_id;

    INSERT INTO public.forecast_run_days (
        run_id, day_index, forecast_date, predicted_covers, closed
    ) VALUES
        (demo_run_id, 1, DATE '2026-10-17', 68, false),
        (demo_run_id, 2, DATE '2026-10-18', 51, false),
        (demo_run_id, 3, DATE '2026-10-19', 38, false),
        (demo_run_id, 4, DATE '2026-10-20', 42, false),
        (demo_run_id, 5, DATE '2026-10-21', 47, false),
        (demo_run_id, 6, DATE '2026-10-22', 55, false),
        (demo_run_id, 7, DATE '2026-10-23', 70, false);

    INSERT INTO public.service_actual_covers (
        service_date, actual_covers, recorded_by, source
    ) VALUES
        (DATE '2026-10-17', 64, NULL, 'demo'),
        (DATE '2026-10-18', 56, NULL, 'demo'),
        (DATE '2026-10-19', 35, NULL, 'demo'),
        (DATE '2026-10-20', 40, NULL, 'demo'),
        (DATE '2026-10-21', 50, NULL, 'demo'),
        (DATE '2026-10-22', 54, NULL, 'demo');
END;
$$;
