"""Deterministic, evidence-based management observations."""


def generate_report_insights(report):
    rows = report["daily_breakdown"]
    insights = []
    summary = report["summary"]
    if summary["peak_date"]:
        insights.append(f"Peak forecast demand is {summary['peak_covers']} covers on {summary['peak_date']}.")
    if summary["quietest_open_date"]:
        insights.append(f"The quietest open day is {summary['quietest_open_date']} with {summary['quietest_open_day_covers']} forecast covers.")
    open_rows = [row for row in rows if row["status"] == "Open"]
    if open_rows:
        costly = max(open_rows, key=lambda row: row["estimated_labour_cost"])
        insights.append(f"Highest estimated labour cost is {costly['estimated_labour_cost']:.2f} on {costly['date']}.")
    event_dates = [row["date"] for row in rows if (row["events"].get("high_impact_event_count") or 0) > 0]
    if event_dates:
        insights.append(f"Higher-impact local events coincide with {', '.join(event_dates)}.")
    rainy = [row["date"] for row in rows if row["weather"].get("available") and (row["weather"].get("rain_probability") or 0) >= 60]
    if rainy:
        insights.append(f"Material rain probability is forecast for {', '.join(rainy)}.")
    closed = [row["date"] for row in rows if row["status"] == "Closed"]
    if closed:
        insights.append(f"The restaurant is closed on {', '.join(closed)}.")
    ratio = report["financials"].get("labour_to_revenue_percentage")
    if ratio is not None and ratio >= 35:
        insights.append(f"Estimated labour is {ratio:.1f}% of forecast revenue; review staffing assumptions.")
    return insights[:6]


def deduplicate_warnings(warnings):
    unique = {}
    for warning in warnings:
        unique.setdefault(warning.get("code", warning.get("message")), warning)
    return list(unique.values())
