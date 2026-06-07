from sqlalchemy import text
from app.db.dbcon import SessionLocal


# Retrieve staffing rules and staff role details from the database.
def get_all_staffing_rules_service():
    with SessionLocal() as db:

        # Retrieve staffing rules and categorise them by demand level.
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
        # Retrieve staff role details used for labour-cost calculations.
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

        # Convert staff role rows into dictionaries for the frontend.
        staff_roles = [
            dict(row._mapping) for row in staff_roles_result.fetchall()
        ]

        return {
            "staffing_rules": staffing_rules,
            "staff_roles": staff_roles
        }