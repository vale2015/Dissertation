"""Side-effect-free staffing and labour calculation."""

ROLE_MAP = {
    "kitchen_staff": ("Kitchen", "Chef"),
    "floor_staff": ("Floor", "Waiter"),
    "bar_staff": ("Bar", "Bartender"),
    "supervisor_staff": ("Management", "Supervisor"),
}


def calculate_staffing(forecast_rows, staffing_rules, staff_roles):
    role_lookup = staff_roles if isinstance(staff_roles, dict) else {
        (row["role_name"], row["department"]): row for row in staff_roles
    }
    results = []
    for day in forecast_rows:
        covers = int(day.get("predicted_total_covers", 0) or 0)
        result = {"date": day["date"], "predicted_covers": covers,
                  "roles": [], "total_staff_assignments": 0,
                  "estimated_labour_cost": 0.0, "warnings": []}
        if day.get("closed"):
            results.append(result); continue
        rule = next((r for r in staffing_rules
                     if int(r.get("min_covers", 0) or 0) <= covers <= int(r.get("max_covers", 0) or 0)), None)
        if not rule:
            result["warnings"].append({"code": "STAFFING_RULE_MISSING", "message": "No staffing rule is available for this demand level."})
            results.append(result); continue
        for key, (department, role_name) in ROLE_MAP.items():
            required = int(rule.get(key, 0) or 0)
            if required <= 0:
                continue
            role = role_lookup.get((role_name, department))
            if not role or role.get("hourly_rate") is None or role.get("standard_shift_hours") is None:
                result["warnings"].append({"code": "STAFF_ROLE_COST_MISSING", "message": f"Cost details are unavailable for {role_name}."})
                continue
            rate = float(role["hourly_rate"]); hours = float(role["standard_shift_hours"])
            cost = round(required * rate * hours, 2)
            result["roles"].append({"role": role_name, "department": department,
                "required_staff": required, "hourly_cost": rate,
                "estimated_hours": hours, "estimated_cost": cost})
            result["total_staff_assignments"] += required
            result["estimated_labour_cost"] += cost
        result["estimated_labour_cost"] = round(result["estimated_labour_cost"], 2)
        results.append(result)
    return results
