"""Secure, Excel-compatible flat CSV export."""

import csv
import io

COLUMNS = ["selected_date","report_start_date","report_end_date","date","day","status","holiday",
    "predicted_covers","total_staff_assignments","staffing_roles","estimated_labour_cost","estimated_revenue",
    "weather_condition","temperature_high","temperature_low","rain_probability","event_count",
    "high_impact_event_count","daily_warnings"]


def safe_cell(value):
    if value is None: return ""
    value = str(value)
    return "'" + value if value.startswith(("=", "+", "-", "@")) else value


def generate_report_csv(report):
    stream=io.StringIO(newline=""); writer=csv.DictWriter(stream,fieldnames=COLUMNS,lineterminator="\r\n")
    writer.writeheader(); meta=report["metadata"]
    for row in report["daily_breakdown"]:
        roles="; ".join(f"{r['role']}: {r['required_staff']}" for r in row["staffing"]["roles"])
        values={"selected_date":meta["selected_date"],"report_start_date":meta["start_date"],"report_end_date":meta["end_date"],
            "date":row["date"],"day":row["day_of_week"],"status":row["status"],"holiday":row["holiday_name"],
            "predicted_covers":row["predicted_covers"],"total_staff_assignments":row["staffing"]["total_staff_assignments"],
            "staffing_roles":roles,"estimated_labour_cost":row["estimated_labour_cost"],"estimated_revenue":row["estimated_revenue"],
            "weather_condition":row["weather"].get("condition"),"temperature_high":row["weather"].get("temperature_high"),
            "temperature_low":row["weather"].get("temperature_low"),"rain_probability":row["weather"].get("rain_probability"),
            "event_count":row["events"].get("event_count"),"high_impact_event_count":row["events"].get("high_impact_event_count"),
            "daily_warnings":"; ".join(w["message"] for w in row["warnings"])}
        writer.writerow({key:safe_cell(values.get(key)) for key in COLUMNS})
    return ("\ufeff"+stream.getvalue()).encode("utf-8")
