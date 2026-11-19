-- PM-authorized extension of the illustrative accuracy dataset (#21).
-- Manual only: do not run as a migration or automatic application seed.
-- Predictions and served covers are invented from existing weekday averages.
-- generated_at remains the true insertion time; no historical timestamp is forged.
-- Four non-active 7-day runs, 28 dates, 24 open days, 23 seeded actuals.
-- One open day awaits manual entry; one zero-actual day exercises zero handling.
-- Replays preserve every existing demo entry and correction.
DO $$
DECLARE
    week_index integer;
    day_offset integer;
    week_start date;
    service_day date;
    run_id_value bigint;
    version_value text;
    weekday_value integer;
    predicted integer;
    served integer;
    weekday_baseline jsonb;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('rfs-demo-accuracy-expansion-20261119'));
    SELECT jsonb_object_agg(weekday::text, baseline) INTO weekday_baseline
    FROM (
        SELECT extract(isodow FROM date)::integer AS weekday,
               greatest(1, round(avg(total_covers)))::integer AS baseline
        FROM public.restaurant_demand_features
        WHERE extract(isodow FROM date) <> 1
        GROUP BY 1
    ) averages;
    IF weekday_baseline IS NULL OR (SELECT count(*) FROM jsonb_object_keys(weekday_baseline)) <> 6 THEN
        RAISE EXCEPTION 'Six open-weekday baselines are required';
    END IF;
    FOR week_index IN 0..3 LOOP
        week_start := DATE '2026-09-19' + week_index * 7;
        version_value := 'demo-expansion-2026-11-19-v2-week-' || week_index;
        IF EXISTS (SELECT 1 FROM public.forecast_runs
                   WHERE model_name = 'accuracy_demo_fixture'
                     AND model_version = version_value) THEN
            CONTINUE;
        END IF;
        IF EXISTS (SELECT 1 FROM public.forecast_run_days
                   WHERE forecast_date BETWEEN week_start AND week_start + 6)
           OR EXISTS (SELECT 1 FROM public.service_actual_covers
                      WHERE service_date BETWEEN week_start AND week_start + 6) THEN
            RAISE EXCEPTION 'Demo expansion dates overlap existing records';
        END IF;
        INSERT INTO public.forecast_runs
            (selected_date, days_ahead, model_name, model_version, prediction)
        VALUES (week_start - 1, 7, 'accuracy_demo_fixture', version_value,
                jsonb_build_object('demo', true,
                  'note', 'Invented after service dates from weekday cover averages; not genuine historical forecasts or served counts',
                  'baseline_weekday_covers', weekday_baseline,
                  'fixture', 'demo-expansion-2026-11-19-v2'))
        RETURNING id INTO run_id_value;
        FOR day_offset IN 0..6 LOOP
            service_day := week_start + day_offset;
            weekday_value := extract(isodow FROM service_day)::integer;
            predicted := CASE WHEN weekday_value = 1 THEN 0
                ELSE greatest(1, (weekday_baseline ->> weekday_value::text)::integer
                     + ((week_index * 3 + day_offset) % 9) - 4) END;
            INSERT INTO public.forecast_run_days
                (run_id, day_index, forecast_date, predicted_covers, closed)
            VALUES (run_id_value, day_offset + 1, service_day, predicted, weekday_value = 1);
            IF weekday_value <> 1 AND service_day <> DATE '2026-10-16' THEN
                served := CASE WHEN service_day = DATE '2026-09-22' THEN 0
                    ELSE greatest(0, predicted + ((week_index * 5 + day_offset * 3) % 13) - 6) END;
                INSERT INTO public.service_actual_covers
                    (service_date, actual_covers, recorded_by, source)
                VALUES (service_day, served, NULL, 'demo');
            END IF;
        END LOOP;
    END LOOP;
END;
$$;
