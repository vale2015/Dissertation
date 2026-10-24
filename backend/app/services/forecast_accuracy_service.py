"""Compare pre-service forecast snapshots with manager-recorded served covers."""

from collections import defaultdict
from datetime import date, datetime, timedelta
import re
from zoneinfo import ZoneInfo

from sqlalchemy import text

from app.db.dbcon import SessionLocal


RESTAURANT_TIMEZONE = ZoneInfo("Europe/London")
ALLOWED_WINDOWS = (30, 90, 180)


class AccuracyInputError(ValueError):
    pass


class AccuracyConflictError(ValueError):
    pass


def _today():
    return datetime.now(RESTAURANT_TIMEZONE).date()


def _eligible_forecast(db, service_date):
    return db.execute(text("""
        SELECT d.run_id
        FROM public.forecast_run_days d
        JOIN public.forecast_runs r ON r.id = d.run_id
        WHERE d.forecast_date = :service_date
          AND d.closed = false
          AND r.generated_at < (d.forecast_date::timestamp AT TIME ZONE 'Europe/London')
        ORDER BY r.generated_at, r.id
        LIMIT 1
    """), {"service_date": service_date}).mappings().first()


def _validate_actual(service_date, covers):
    if not isinstance(service_date, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", service_date):
        raise AccuracyInputError("service_date must be an ISO date.")
    try:
        parsed_date = date.fromisoformat(service_date)
    except (TypeError, ValueError) as error:
        raise AccuracyInputError("service_date must be an ISO date.") from error
    if parsed_date >= _today():
        raise AccuracyInputError("Actual covers can only be recorded after the service day.")
    if isinstance(covers, bool) or not isinstance(covers, int) or not 0 <= covers <= 100000:
        raise AccuracyInputError("actual_covers must be an integer from 0 to 100000.")
    return parsed_date


def record_actual(service_date, covers, user_id):
    parsed_date = _validate_actual(service_date, covers)
    with SessionLocal() as db:
        if _eligible_forecast(db, parsed_date) is None:
            raise AccuracyInputError("No eligible open-day forecast was saved before this service.")
        row = db.execute(text("""
            INSERT INTO public.service_actual_covers (service_date, actual_covers, recorded_by)
            VALUES (:service_date, :covers, :user_id)
            ON CONFLICT (service_date) DO NOTHING
            RETURNING service_date
        """), {"service_date": parsed_date, "covers": covers, "user_id": user_id}).first()
        if row is None:
            raise AccuracyConflictError("Actual covers already exist; use a correction with a reason.")
        db.commit()
    return {"service_date": parsed_date.isoformat(), "actual_covers": covers}


def correct_actual(service_date, covers, reason, user_id):
    parsed_date = _validate_actual(service_date, covers)
    if not isinstance(reason, str) or not 5 <= len(reason.strip()) <= 500:
        raise AccuracyInputError("A correction reason of 5 to 500 characters is required.")
    with SessionLocal() as db:
        row = db.execute(text("""
            SELECT actual_covers FROM public.service_actual_covers
            WHERE service_date = :service_date FOR UPDATE
        """), {"service_date": parsed_date}).mappings().first()
        if row is None:
            raise AccuracyInputError("Record the first actual before correcting it.")
        previous = row["actual_covers"]
        if previous == covers:
            raise AccuracyInputError("The corrected value must differ from the recorded value.")
        db.execute(text("""
            INSERT INTO public.service_actual_corrections
                (service_date, previous_covers, corrected_covers, reason, corrected_by)
            VALUES (:service_date, :previous, :covers, :reason, :user_id)
        """), {"service_date": parsed_date, "previous": previous,
                "covers": covers, "reason": reason.strip(), "user_id": user_id})
        db.execute(text("""
            UPDATE public.service_actual_covers
            SET actual_covers = :covers, updated_by = :user_id, updated_at = now()
            WHERE service_date = :service_date
        """), {"service_date": parsed_date, "covers": covers, "user_id": user_id})
        db.commit()
    return {"service_date": parsed_date.isoformat(), "actual_covers": covers}


def _metrics(rows):
    matched = [row for row in rows if row["actual_covers"] is not None]
    if not matched:
        return {"evaluated_days": 0, "mean_absolute_error": None,
                "mean_absolute_percentage_error": None, "mean_bias": None,
                "zero_actual_days_excluded_from_mape": 0}
    errors = [row["predicted_covers"] - row["actual_covers"] for row in matched]
    percentage_errors = [abs(row["error_covers"]) / row["actual_covers"] * 100
                         for row in matched if row["actual_covers"] > 0]
    return {
        "evaluated_days": len(matched),
        "mean_absolute_error": round(sum(map(abs, errors)) / len(errors), 2),
        "mean_absolute_percentage_error": round(sum(percentage_errors) / len(percentage_errors), 2)
        if percentage_errors else None,
        "mean_bias": round(sum(errors) / len(errors), 2),
        "zero_actual_days_excluded_from_mape": len(matched) - len(percentage_errors),
    }


def get_accuracy_report(window_days=90):
    if window_days not in ALLOWED_WINDOWS:
        raise AccuracyInputError("days must be 30, 90, or 180.")
    today = _today()
    start = today - timedelta(days=window_days)
    with SessionLocal() as db:
        records = db.execute(text("""
            WITH original AS (
                SELECT DISTINCT ON (d.forecast_date)
                    d.forecast_date, d.predicted_covers, d.day_index,
                    r.id AS run_id, r.generated_at, r.model_version
                FROM public.forecast_run_days d
                JOIN public.forecast_runs r ON r.id = d.run_id
                WHERE d.forecast_date >= :start_date
                  AND d.forecast_date < :today
                  AND d.closed = false
                  AND r.generated_at < (d.forecast_date::timestamp AT TIME ZONE 'Europe/London')
                ORDER BY d.forecast_date, r.generated_at, r.id
            )
            SELECT o.forecast_date, o.predicted_covers, o.day_index, o.run_id,
                   o.generated_at, o.model_version, a.actual_covers,
                   f.total_covers AS booked_covers
            FROM original o
            LEFT JOIN public.service_actual_covers a ON a.service_date = o.forecast_date
            LEFT JOIN public.restaurant_demand_features f ON f.date = o.forecast_date
            ORDER BY o.forecast_date DESC
            LIMIT :window_days
        """), {"start_date": start, "today": today,
               "window_days": window_days}).mappings().all()

    rows = []
    for record in records:
        forecast_date = record["forecast_date"]
        actual = record["actual_covers"]
        predicted = record["predicted_covers"]
        rows.append({
            "service_date": forecast_date.isoformat(),
            "weekday": forecast_date.strftime("%A"),
            "run_id": record["run_id"],
            "generated_at": record["generated_at"].isoformat(),
            "model_version": record["model_version"],
            "lead_days": record["day_index"],
            "predicted_covers": predicted,
            "booked_covers": record["booked_covers"],
            "actual_covers": actual,
            "error_covers": predicted - actual if actual is not None else None,
        })

    by_weekday = defaultdict(list)
    by_lead_days = defaultdict(list)
    for row in rows:
        if row["actual_covers"] is not None:
            by_weekday[row["weekday"]].append(row)
            by_lead_days[row["lead_days"]].append(row)
    return {
        "window_days": window_days,
        "eligible_days": len(rows),
        "awaiting_actual_days": sum(row["actual_covers"] is None for row in rows),
        "summary": _metrics(rows),
        "by_weekday": [{"weekday": day, **_metrics(by_weekday[day])}
                       for day in ("Monday", "Tuesday", "Wednesday", "Thursday",
                                   "Friday", "Saturday", "Sunday") if day in by_weekday],
        "by_lead_days": [{"lead_days": lead, **_metrics(group)}
                         for lead, group in sorted(by_lead_days.items())],
        "days": rows,
    }
