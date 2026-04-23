'''from datetime import datetime
from sqlalchemy import text

from app.db.dbcon import SessionLocal
from app.ml.pipelines.predict_pipeline import prediction_demand


ROLE_MAP = {
    "kitchen_staff": {"department": "Kitchen", "role_name": "Chef"},
    "floor_staff": {"department": "Floor", "role_name": "Waiter"},
    "bar_staff": {"department": "Bar", "role_name": "Bartender"},
    "supervisor_staff": {"department": "Management", "role_name": "Supervisor"},
}


def _get_staffing_rule_for_covers(db, predicted_covers):
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
            WHERE :covers BETWEEN min_covers AND max_covers
            ORDER BY min_covers ASC
            LIMIT 1
        """),
        {"covers": predicted_covers}
    ).mappings().first()


def _get_staff_role(db, role_name, department):
    return db.execute(
        text("""
            SELECT
                id,
                role_name,
                department,
                hourly_rate,
                standard_shift_hours
            FROM public.staff_roles
            WHERE role_name = :role_name
              AND department = :department
            LIMIT 1
        """),
        {
            "role_name": role_name,
            "department": department,
        }
    ).mappings().first()


def _delete_existing_forecast_for_date(db, forecast_date):
    db.execute(
        text("""
            DELETE FROM public.staff_cost_forecast
            WHERE forecast_date = :forecast_date
        """),
        {"forecast_date": forecast_date}
    )


def _insert_staff_cost_forecast_row(
    db,
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
                :forecast_date,
                :predicted_covers,
                :department,
                :role_name,
                :required_staff,
                :hourly_rate,
                :shift_hours,
                :estimated_cost,
                :generated_at
            )
        """),
        {
            "forecast_date": forecast_date,
            "predicted_covers": predicted_covers,
            "department": department,
            "role_name": role_name,
            "required_staff": required_staff,
            "hourly_rate": hourly_rate,
            "shift_hours": shift_hours,
            "estimated_cost": estimated_cost,
            "generated_at": datetime.utcnow(),
        }
    )


def _build_demand_level_label(rule):
    min_covers = int(rule.get("min_covers", 0) or 0)
    max_covers = int(rule.get("max_covers", 0) or 0)
    return f"{min_covers}-{max_covers} covers"


def generate_staff_cost_forecast(days_ahead=7, selected_date=None):
    forecast_result = prediction_demand(
        days_ahead=days_ahead,
        selected_date=selected_date,
    )

    if "forecast" not in forecast_result:
        return forecast_result

    forecast_days = forecast_result.get("forecast", [])
    generated_rows = []
    daily_totals = []

    with SessionLocal() as db:
        try:
            for day in forecast_days:
                forecast_date = day["date"]
                predicted_covers = int(day.get("predicted_total_covers", 0) or 0)
                is_closed = bool(day.get("closed", False))
                closure_reason = day.get("closure_reason")

                _delete_existing_forecast_for_date(db, forecast_date)

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

                rule = _get_staffing_rule_for_covers(db, predicted_covers)

                if not rule:
                    daily_totals.append({
                        "forecast_date": forecast_date,
                        "predicted_covers": predicted_covers,
                        "total_estimated_cost": 0.0,
                        "closed": False,
                        "closure_reason": None,
                        "demand_level": None,
                        "message": "No staffing rule found for this demand level",
                        "rule_applied": None,
                        "operational_roles": [],
                    })
                    continue

                day_total_cost = 0.0
                day_roles = []

                for staff_key, role_info in ROLE_MAP.items():
                    required_staff = int(rule.get(staff_key, 0) or 0)

                    if required_staff <= 0:
                        continue

                    role = _get_staff_role(
                        db,
                        role_name=role_info["role_name"],
                        department=role_info["department"],
                    )

                    if not role:
                        continue

                    hourly_rate = float(role.get("hourly_rate", 0) or 0)
                    shift_hours = float(role.get("standard_shift_hours", 0) or 0)
                    estimated_cost = round(
                        required_staff * hourly_rate * shift_hours,
                        2
                    )

                    _insert_staff_cost_forecast_row(
                        db=db,
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

            db.commit()

        except Exception:
            db.rollback()
            raise

    return {
        "message": "Staff cost forecast generated successfully",
        "days_ahead": days_ahead,
        "selected_date": selected_date,
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
                ORDER BY forecast_date ASC, department ASC, role_name ASC
            """)
        ).mappings().all()

        return [dict(row) for row in result]


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
                ORDER BY department ASC, role_name ASC
            """),
            {"forecast_date": forecast_date}
        ).mappings().all()

        return [dict(row) for row in result]'''

from datetime import datetime
from sqlalchemy import text

from app.db.dbcon import SessionLocal
from app.ml.pipelines.predict_pipeline import prediction_demand


ROLE_MAP = {
    "kitchen_staff": {"department": "Kitchen", "role_name": "Chef"},
    "floor_staff": {"department": "Floor", "role_name": "Waiter"},
    "bar_staff": {"department": "Bar", "role_name": "Bartender"},
    "supervisor_staff": {"department": "Management", "role_name": "Supervisor"},
}


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


def _delete_existing_forecast_for_date(db, forecast_date):
    db.execute(
        text("""
            DELETE FROM public.staff_cost_forecast
            WHERE forecast_date = :forecast_date
        """),
        {"forecast_date": forecast_date}
    )


def _insert_staff_cost_forecast_row(
    db,
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
                :forecast_date,
                :predicted_covers,
                :department,
                :role_name,
                :required_staff,
                :hourly_rate,
                :shift_hours,
                :estimated_cost,
                :generated_at
            )
        """),
        {
            "forecast_date": forecast_date,
            "predicted_covers": predicted_covers,
            "department": department,
            "role_name": role_name,
            "required_staff": required_staff,
            "hourly_rate": hourly_rate,
            "shift_hours": shift_hours,
            "estimated_cost": estimated_cost,
            "generated_at": datetime.utcnow(),
        }
    )


def _build_demand_level_label(rule):
    min_covers = int(rule.get("min_covers", 0) or 0)
    max_covers = int(rule.get("max_covers", 0) or 0)
    return f"{min_covers}-{max_covers} covers"


def generate_staff_cost_forecast(days_ahead=7, selected_date=None):
    forecast_result = prediction_demand(
        days_ahead=days_ahead,
        selected_date=selected_date,
    )

    if "forecast" not in forecast_result:
        return forecast_result

    forecast_days = forecast_result.get("forecast", [])
    generated_rows = []
    daily_totals = []

    with SessionLocal() as db:
        try:
            staffing_rules = _get_all_staffing_rules(db)
            staff_roles = _get_all_staff_roles(db)

            for day in forecast_days:
                forecast_date = day["date"]
                predicted_covers = int(day.get("predicted_total_covers", 0) or 0)
                is_closed = bool(day.get("closed", False))
                closure_reason = day.get("closure_reason")

                _delete_existing_forecast_for_date(db, forecast_date)

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
                    daily_totals.append({
                        "forecast_date": forecast_date,
                        "predicted_covers": predicted_covers,
                        "total_estimated_cost": 0.0,
                        "closed": False,
                        "closure_reason": None,
                        "demand_level": None,
                        "message": "No staffing rule found for this demand level",
                        "rule_applied": None,
                        "operational_roles": [],
                    })
                    continue

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
                        continue

                    hourly_rate = float(role.get("hourly_rate", 0) or 0)
                    shift_hours = float(role.get("standard_shift_hours", 0) or 0)
                    estimated_cost = round(
                        required_staff * hourly_rate * shift_hours,
                        2
                    )

                    _insert_staff_cost_forecast_row(
                        db=db,
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

            db.commit()

        except Exception:
            db.rollback()
            raise

    return {
        "message": "Staff cost forecast generated successfully",
        "days_ahead": days_ahead,
        "selected_date": selected_date,
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
                ORDER BY forecast_date ASC, department ASC, role_name ASC
            """)
        ).mappings().all()

        return [dict(row) for row in result]


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
                ORDER BY department ASC, role_name ASC
            """),
            {"forecast_date": forecast_date}
        ).mappings().all()

        return [dict(row) for row in result]