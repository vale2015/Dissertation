import json
from datetime import date, timedelta
from sqlalchemy import text

from app.db.dbcon import SessionLocal
from app.ml.pipelines.predict_pipeline import prediction_demand

# Map staffing rule columns to the operational roles stored in the staff_roles table.
ROLE_MAP = {
    "kitchen_staff": {"department": "Kitchen", "role_name": "Chef"},
    "floor_staff": {"department": "Floor", "role_name": "Waiter"},
    "bar_staff": {"department": "Bar", "role_name": "Bartender"},
    "supervisor_staff": {"department": "Management", "role_name": "Supervisor"},
}

# Retrieve all staffing rules ordered by demand level.
def _get_all_staffing_rules(db):
    return db.execute(
        text("""
            SELECT
                id,
                min_covers,
                max_covers,
                kitchen_staff,
                floor_staff,
                bar_staff,
                supervisor_staff
            FROM public.staffing_rules
            ORDER BY min_covers ASC
        """)
    ).mappings().all()

# Select the correct staffing rule based on the predicted number of covers.
def _get_staffing_rule_for_covers(rules, predicted_covers):
    for rule in rules:
        min_covers = int(rule.get("min_covers", 0) or 0)
        max_covers = int(rule.get("max_covers", 0) or 0)

        if min_covers <= predicted_covers <= max_covers:
            return rule

    return None


def _get_all_staff_roles(db):
    rows = db.execute(
        text("""
            SELECT
                id,
                role_name,
                department,
                hourly_rate,
                standard_shift_hours
            FROM public.staff_roles
        """)
    ).mappings().all()

    return {
        (row["role_name"], row["department"]): row
        for row in rows
    }

class ForecastRunError(ValueError):
    pass


def _validated_forecast_days(forecast_result, days_ahead):
    if days_ahead not in (7, 10) or not isinstance(forecast_result, dict):
        raise ForecastRunError("A complete 7- or 10-day forecast is required.")
    try:
        base_date = date.fromisoformat(forecast_result["selected_date"])
        days = forecast_result["forecast"]
        if not isinstance(days, list) or len(days) != days_ahead:
            raise ValueError
        if not isinstance(forecast_result["model_version"], str) or not forecast_result["model_version"]:
            raise ValueError
        for index, day in enumerate(days, 1):
            if date.fromisoformat(day["date"]) != base_date + timedelta(days=index):
                raise ValueError
            covers = day["predicted_total_covers"]
            if isinstance(covers, bool) or not isinstance(covers, int) or covers < 0:
                raise ValueError
            if day.get("closed") and covers != 0:
                raise ValueError
    except (KeyError, TypeError, ValueError) as error:
        raise ForecastRunError("The prediction is incomplete; the active run was not changed.") from error
    return days


def _insert_forecast_run(db, result, days_ahead):
    return db.execute(text("""
        INSERT INTO public.forecast_runs (
            selected_date, days_ahead, model_name, model_version, prediction
        ) VALUES (
            :selected_date, :days_ahead, :model_name, :model_version,
            CAST(:prediction AS jsonb)
        ) RETURNING id
    """), {
        "selected_date": result["selected_date"],
        "days_ahead": days_ahead,
        "model_name": result["model"],
        "model_version": result["model_version"],
        "prediction": json.dumps(result, separators=(",", ":"), allow_nan=False),
    }).scalar_one()


def _insert_forecast_day(db, run_id, index, day):
    db.execute(text("""
        INSERT INTO public.forecast_run_days (
            run_id, day_index, forecast_date, predicted_covers, closed
        ) VALUES (:run_id, :day_index, :forecast_date, :predicted_covers, :closed)
    """), {
        "run_id": run_id, "day_index": index, "forecast_date": day["date"],
        "predicted_covers": day["predicted_total_covers"],
        "closed": bool(day.get("closed", False)),
    })


def _activate_forecast_run(db, run_id):
    db.execute(text("""
        INSERT INTO public.active_forecast_run (singleton_id, run_id)
        VALUES (1, :run_id)
        ON CONFLICT (singleton_id) DO UPDATE SET
            run_id = EXCLUDED.run_id, activated_at = now()
    """), {"run_id": run_id})

# Insert one staff-cost forecast row into the database.
def _insert_staff_cost_forecast_row(
    db,
    run_id,
    forecast_date,
    predicted_covers,
    department,
    role_name,
    required_staff,
    hourly_rate,
    shift_hours,
    estimated_cost,
):
    db.execute(
        text("""
            INSERT INTO public.staff_cost_forecast (
                run_id,
                forecast_date,
                predicted_covers,
                department,
                role_name,
                required_staff,
                hourly_rate,
                shift_hours,
                estimated_cost,
                generated_at
            )
            VALUES (
                :run_id,
                :forecast_date,
                :predicted_covers,
                :department,
                :role_name,
                :required_staff,
                :hourly_rate,
                :shift_hours,
                :estimated_cost,
                now()
            )
        """),
        {
            "run_id": run_id,
            "forecast_date": forecast_date,
            "predicted_covers": predicted_covers,
            "department": department,
            "role_name": role_name,
            "required_staff": required_staff,
            "hourly_rate": hourly_rate,
            "shift_hours": shift_hours,
            "estimated_cost": estimated_cost,
        }
    )

# Create a readable demand level label for the frontend.
def _build_demand_level_label(rule):
    min_covers = int(rule.get("min_covers", 0) or 0)
    max_covers = int(rule.get("max_covers", 0) or 0)
    return f"{min_covers}-{max_covers} covers"

# Generate staff-cost forecasts using demand predictions and staffing rules.
def generate_staff_cost_forecast(days_ahead=7, selected_date=None):
    forecast_result = prediction_demand(
        days_ahead=days_ahead,
        selected_date=selected_date,
    )

    forecast_days = _validated_forecast_days(forecast_result, days_ahead)
    generated_rows = []
    daily_totals = []

    with SessionLocal() as db:
        try:
            staffing_rules = _get_all_staffing_rules(db)
            staff_roles = _get_all_staff_roles(db)
            run_id = _insert_forecast_run(db, forecast_result, days_ahead)

            for index, day in enumerate(forecast_days, 1):
                forecast_date = day["date"]
                predicted_covers = int(day.get("predicted_total_covers", 0) or 0)
                is_closed = bool(day.get("closed", False))
                closure_reason = day.get("closure_reason")

                _insert_forecast_day(db, run_id, index, day)

                if is_closed:
                    daily_totals.append({
                        "forecast_date": forecast_date,
                        "predicted_covers": predicted_covers,
                        "total_estimated_cost": 0.0,
                        "closed": True,
                        "closure_reason": closure_reason,
                        "demand_level": "Closed",
                        "rule_applied": None,
                        "operational_roles": [],
                    })
                    continue

                rule = _get_staffing_rule_for_covers(staffing_rules, predicted_covers)

                if not rule:
                    raise ForecastRunError(
                        "No staffing rule covers every forecast day; the active run was not changed."
                    )

                day_total_cost = 0.0
                day_roles = []

                for staff_key, role_info in ROLE_MAP.items():
                    required_staff = int(rule.get(staff_key, 0) or 0)

                    if required_staff <= 0:
                        continue

                    role = staff_roles.get(
                        (role_info["role_name"], role_info["department"])
                    )

                    if not role:
                        raise ForecastRunError(
                            "A required staff role is missing; the active run was not changed."
                        )

                    hourly_rate = float(role.get("hourly_rate", 0) or 0)
                    shift_hours = float(role.get("standard_shift_hours", 0) or 0)
                    estimated_cost = round(
                        required_staff * hourly_rate * shift_hours,
                        2
                    )

                    _insert_staff_cost_forecast_row(
                        db=db,
                        run_id=run_id,
                        forecast_date=forecast_date,
                        predicted_covers=predicted_covers,
                        department=role["department"],
                        role_name=role["role_name"],
                        required_staff=required_staff,
                        hourly_rate=hourly_rate,
                        shift_hours=shift_hours,
                        estimated_cost=estimated_cost,
                    )

                    row_data = {
                        "forecast_date": forecast_date,
                        "predicted_covers": predicted_covers,
                        "department": role["department"],
                        "role_name": role["role_name"],
                        "required_staff": required_staff,
                        "hourly_rate": hourly_rate,
                        "shift_hours": shift_hours,
                        "estimated_cost": estimated_cost,
                    }

                    generated_rows.append(row_data)
                    day_roles.append(row_data)
                    day_total_cost += estimated_cost

                daily_totals.append({
                    "forecast_date": forecast_date,
                    "predicted_covers": predicted_covers,
                    "total_estimated_cost": round(day_total_cost, 2),
                    "closed": False,
                    "closure_reason": None,
                    "demand_level": _build_demand_level_label(rule),
                    "rule_applied": {
                        "id": rule.get("id"),
                        "min_covers": rule.get("min_covers"),
                        "max_covers": rule.get("max_covers"),
                        "kitchen_staff": int(rule.get("kitchen_staff", 0) or 0),
                        "floor_staff": int(rule.get("floor_staff", 0) or 0),
                        "bar_staff": int(rule.get("bar_staff", 0) or 0),
                        "supervisor_staff": int(rule.get("supervisor_staff", 0) or 0),
                    },
                    "operational_roles": day_roles,
                })

            _activate_forecast_run(db, run_id)
            db.commit()

        except Exception:
            db.rollback()
            raise

    return {
        "message": "Staff cost forecast generated successfully",
        "run_id": run_id,
        "model_version": forecast_result["model_version"],
        "days_ahead": days_ahead,
        "selected_date": forecast_result["selected_date"],
        "daily_totals": daily_totals,
        "results": generated_rows,
    }
def get_all_staff_cost_forecast_records():
    with SessionLocal() as db:
        result = db.execute(
            text("""
                SELECT
                    id,
                    forecast_date,
                    predicted_covers,
                    department,
                    role_name,
                    required_staff,
                    hourly_rate,
                    shift_hours,
                    estimated_cost,
                    generated_at
                FROM public.staff_cost_forecast
                WHERE run_id = (SELECT run_id FROM public.active_forecast_run WHERE singleton_id = 1)
                   OR (run_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.active_forecast_run))
                ORDER BY forecast_date ASC, department ASC, role_name ASC
            """)
        ).mappings().all()

        return [dict(row) for row in result]


def list_forecast_runs():
    with SessionLocal() as db:
        rows = db.execute(text("""
            SELECT r.id, r.selected_date, r.days_ahead, r.model_name,
                   r.model_version, r.generated_at,
                   COALESCE(a.run_id = r.id, false) AS active
            FROM public.forecast_runs r
            LEFT JOIN public.active_forecast_run a ON a.singleton_id = 1
            WHERE r.model_name <> 'accuracy_demo_fixture'
            ORDER BY r.id DESC LIMIT 20
        """)).mappings().all()
    return [_serializable_run_row(row) for row in rows]


def _serializable_run_row(row):
    return {
        key: value.isoformat() if hasattr(value, "isoformat") else value
        for key, value in row.items()
    }


def get_forecast_run(run_id):
    with SessionLocal() as db:
        row = db.execute(text("""
            SELECT r.id, r.selected_date, r.days_ahead, r.model_name,
                   r.model_version, r.generated_at, r.prediction,
                   COALESCE(a.run_id = r.id, false) AS active
            FROM public.forecast_runs r
            LEFT JOIN public.active_forecast_run a ON a.singleton_id = 1
            WHERE r.id = :run_id
        """), {"run_id": run_id}).mappings().first()
        if row is None:
            return None
        staff_rows = db.execute(text("""
            SELECT forecast_date, predicted_covers, department, role_name,
                   required_staff, hourly_rate, shift_hours, estimated_cost
            FROM public.staff_cost_forecast
            WHERE run_id = :run_id
            ORDER BY forecast_date, department, role_name
        """), {"run_id": run_id}).mappings().all()
    return {**_serializable_run_row(row),
            "staffing": [_serializable_run_row(staff) for staff in staff_rows]}

# Retrieves staff-cost forecast records for a selected forecast date.
def get_staff_cost_forecast_by_date_service(forecast_date):
    with SessionLocal() as db:
        result = db.execute(
            text("""
                SELECT
                    id,
                    forecast_date,
                    predicted_covers,
                    department,
                    role_name,
                    required_staff,
                    hourly_rate,
                    shift_hours,
                    estimated_cost,
                    generated_at
                FROM public.staff_cost_forecast
                WHERE forecast_date = :forecast_date
                  AND (run_id = (SELECT run_id FROM public.active_forecast_run WHERE singleton_id = 1)
                    OR (run_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.active_forecast_run)))
                ORDER BY department ASC, role_name ASC
            """),
            {"forecast_date": forecast_date}
        ).mappings().all()

        return [dict(row) for row in result]
