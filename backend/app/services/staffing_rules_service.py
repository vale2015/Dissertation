from sqlalchemy import text
from app.db.dbcon import SessionLocal


def get_all_staffing_rules_service():
    with SessionLocal() as db:
        rules_result = db.execute(
            text("""
                SELECT
                    id,
                    min_covers,
                    max_covers,
                    floor_staff,
                    kitchen_staff,
                    bar_staff,
                    supervisor_staff
                FROM public.staffing_rules
                ORDER BY min_covers ASC
            """)
        ).mappings().all()

        rules = []

        for row in rules_result:
            row_dict = dict(row)

            floor_staff = int(row_dict.get("floor_staff", 0) or 0)
            kitchen_staff = int(row_dict.get("kitchen_staff", 0) or 0)
            bar_staff = int(row_dict.get("bar_staff", 0) or 0)
            supervisor_staff = int(row_dict.get("supervisor_staff", 0) or 0)

            total_staff = floor_staff + kitchen_staff + bar_staff + supervisor_staff

            min_covers = int(row_dict.get("min_covers", 0) or 0)
            max_covers = int(row_dict.get("max_covers", 0) or 0)

            if min_covers == 0 and max_covers == 0:
                demand_level = "Closed"
            elif max_covers <= 20:
                demand_level = "Low"
            elif max_covers <= 35:
                demand_level = "Moderate"
            elif max_covers <= 45:
                demand_level = "High"
            else:
                demand_level = "Very High"

            row_dict["demand_level"] = demand_level
            row_dict["total_staff"] = total_staff

            rules.append(row_dict)

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
        ).mappings().all()

        staff_roles = [dict(row) for row in staff_roles_result]

        return {
            "rules": rules,
            "staff_roles": staff_roles,
        }