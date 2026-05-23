from sqlalchemy import text
from app.db.dbcon import SessionLocal


def get_all_staffing_rules_service():
    with SessionLocal() as db:
        staffing_rules_result = db.execute(
            text("""
                SELECT
                    id,
                    CASE
                        WHEN min_covers BETWEEN 0 AND 20 THEN 'Low Demand'
                        WHEN min_covers BETWEEN 21 AND 60 THEN 'Medium Demand'
                        WHEN min_covers BETWEEN 61 AND 80 THEN 'High Demand'
                        ELSE 'Very High Demand'
                    END AS demand_level,
                    min_covers,
                    max_covers,
                    (
                        floor_staff +
                        kitchen_staff +
                        bar_staff +
                        supervisor_staff
                    ) AS total_staff,
                    floor_staff AS front_of_house,
                    kitchen_staff AS kitchen,
                    bar_staff AS bar,
                    supervisor_staff AS supervisor
                FROM public.staffing_rules
                ORDER BY min_covers ASC
            """)
        )

        staffing_rules = [
            dict(row._mapping) for row in staffing_rules_result.fetchall()
        ]

        staff_roles_result = db.execute(
            text("""
                SELECT
                    id,
                    role_name,
                    department,
                    hourly_rate,
                    standard_shift_hours
                FROM public.staff_roles
                ORDER BY department ASC, role_name ASC
            """)
        )

        staff_roles = [
            dict(row._mapping) for row in staff_roles_result.fetchall()
        ]

        return {
            "staffing_rules": staffing_rules,
            "staff_roles": staff_roles
        }