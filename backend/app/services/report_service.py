"""Canonical, on-demand management-report aggregation."""

from datetime import datetime, timezone
from statistics import mean
from sqlalchemy import text

from app.config import get_report_configuration
from app.db.dbcon import SessionLocal
from app.ml.pipelines.predict_pipeline import prediction_demand
from app.services.events_service import get_local_events
from app.services.report_contract import empty_management_report
from app.services.report_insight_service import deduplicate_warnings, generate_report_insights
from app.services.staff_cost_service import _get_all_staffing_rules, _get_all_staff_roles
from app.services.staffing_calculation_service import calculate_staffing
from app.services.weather_service import get_weather_forecast


class ReportGenerationError(RuntimeError): pass
class ReportDateUnavailable(ReportGenerationError): pass


def _round(value): return round(float(value), 2)


def _load_internal_data():
    with SessionLocal() as db:
        rules = [dict(row) for row in _get_all_staffing_rules(db)]
        roles = {key: dict(value) for key, value in _get_all_staff_roles(db).items()}
        settings = db.execute(text("""SELECT average_spend_per_cover, food_cost_percentage
            FROM public.business_settings ORDER BY id DESC LIMIT 1""")).mappings().first()
    return rules, roles, dict(settings) if settings else None


def _financial_values(covers, labour, settings):
    if not settings or settings.get("average_spend_per_cover") is None or settings.get("food_cost_percentage") is None:
        return {"estimated_revenue": None, "estimated_food_cost": None,
                "estimated_gross_profit_before_labour": None,
                "estimated_contribution_after_food_and_labour": None,
                "labour_to_revenue_percentage": None}
    spend = float(settings["average_spend_per_cover"])
    food_pct = float(settings["food_cost_percentage"])
    if food_pct > 1: food_pct /= 100
    revenue = _round(covers * spend); food = _round(revenue * food_pct)
    return {"estimated_revenue": revenue, "estimated_food_cost": food,
        "estimated_gross_profit_before_labour": _round(revenue-food),
        "estimated_contribution_after_food_and_labour": _round(revenue-food-labour),
        "labour_to_revenue_percentage": _round(labour/revenue*100) if revenue else None}


def generate_management_report(selected_date, days_ahead, *, predictor=prediction_demand,
                               internal_loader=_load_internal_data,
                               weather_loader=get_weather_forecast,
                               events_loader=get_local_events):
    prediction = predictor(days_ahead=days_ahead, selected_date=selected_date)
    forecast = prediction.get("forecast") if isinstance(prediction, dict) else None
    if not forecast:
        message = prediction.get("message", "Demand forecast is unavailable.") if isinstance(prediction, dict) else "Demand forecast is unavailable."
        if "selected date" in message.lower(): raise ReportDateUnavailable(message)
        raise ReportGenerationError(message)
    rows = sorted((dict(row) for row in forecast), key=lambda row: row["date"])
    rules, roles, settings = internal_loader()
    staffing = {row["date"]: row for row in calculate_staffing(rows, rules, roles)}
    report = empty_management_report(); cfg = get_report_configuration()
    report["metadata"].update({"selected_date": selected_date, "start_date": rows[0]["date"],
        "end_date": rows[-1]["date"], "days_ahead": days_ahead,
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"), **cfg})
    warnings = []
    report["data_sources"]["demand"] = {"available": True, "message": None}
    report["data_sources"]["staffing"] = {"available": bool(rules and roles), "message": None if rules and roles else "Staffing configuration is incomplete."}
    report["data_sources"]["business_settings"] = {"available": bool(settings), "message": None if settings else "Business settings are unavailable."}
    if not settings: warnings.append({"code":"BUSINESS_SETTINGS_MISSING","message":"Financial projections are unavailable because business settings are missing."})
    try:
        weather_data = weather_loader(); weather_by_date = {d["date"]: d for d in weather_data.get("daily_forecast", [])}
        report["data_sources"]["weather"] = {"available": True, "message": weather_data.get("warning")}
    except Exception:
        weather_by_date = {}; report["data_sources"]["weather"] = {"available": False, "message":"Weather information is unavailable."}
        warnings.append({"code":"WEATHER_UNAVAILABLE","message":"Weather information is unavailable for this report."})
    try:
        event_data = events_loader(rows[0]["date"], rows[-1]["date"]); event_by_date = {d["date"]:d for d in event_data.get("days",[])}
        report["data_sources"]["events"] = {"available": True, "message": event_data.get("warning")}
    except Exception:
        event_by_date = {}; report["data_sources"]["events"] = {"available": False, "message":"Local events are unavailable."}
        warnings.append({"code":"EVENTS_UNAVAILABLE","message":"Local-event information is unavailable for this report."})
    feature_values = {key: [] for key in ("same_day_avg_7","walk_in_avg_7","advance_avg_7","duration_avg_7")}
    for row in rows:
        staff = staffing[row["date"]]; warnings.extend(staff["warnings"])
        features = row.get("input_features") or {}
        for key in feature_values:
            if features.get(key) is not None: feature_values[key].append(float(features[key]))
        weather = weather_by_date.get(row["date"])
        weather_context = ({"available": True, "condition": weather.get("label") or weather.get("condition"),
            "temperature_high": weather.get("temperature_max"), "temperature_low": weather.get("temperature_min"),
            "rain_probability": weather.get("precipitation_probability")} if weather else
            {"available":False,"reason":"Weather forecast unavailable for this date."})
        events = event_by_date.get(row["date"])
        event_list = events.get("events",[]) if events else []
        event_context = ({"available": bool(events.get("supported", True)), "event_count": events.get("event_count",len(event_list)),
            "high_impact_event_count": sum(1 for e in event_list if e.get("impact_level") == "High") or int(events.get("impact_level") == "High"),
            "events_summary": ", ".join(e.get("name", "Event") for e in event_list[:3])} if events else
            {"available":False,"event_count":None,"high_impact_event_count":None,"events_summary":None})
        daily_fin = _financial_values(staff["predicted_covers"], staff["estimated_labour_cost"], settings)
        report["daily_breakdown"].append({"date":row["date"],"day_of_week":row.get("day_of_week"),
            "status":"Closed" if row.get("closed") else "Open", "holiday_name":row.get("holiday_name"),
            "closure_reason":row.get("closure_reason"), "predicted_covers":staff["predicted_covers"],
            "staffing":{"total_staff_assignments":staff["total_staff_assignments"],"roles":staff["roles"]},
            "estimated_labour_cost":staff["estimated_labour_cost"], **daily_fin,
            "weather":weather_context,"events":event_context,"warnings":staff["warnings"]})
    open_rows=[r for r in report["daily_breakdown"] if r["status"]=="Open"]
    covers=sum(r["predicted_covers"] for r in report["daily_breakdown"])
    peak=max(open_rows,key=lambda r:r["predicted_covers"]) if open_rows else None
    quiet=min(open_rows,key=lambda r:r["predicted_covers"]) if open_rows else None
    report["summary"].update({"forecasted_covers":covers,"open_days":len(open_rows),"closed_days":len(rows)-len(open_rows),
        "average_daily_covers":_round(covers/len(open_rows)) if open_rows else None,"peak_date":peak["date"] if peak else None,
        "peak_covers":peak["predicted_covers"] if peak else None,"quietest_open_date":quiet["date"] if quiet else None,
        "quietest_open_day_covers":quiet["predicted_covers"] if quiet else None,
        "total_staff_assignments":sum(r["staffing"]["total_staff_assignments"] for r in report["daily_breakdown"])})
    labour=_round(sum(r["estimated_labour_cost"] for r in report["daily_breakdown"])); totals=_financial_values(covers,labour,settings)
    food_pct=float(settings["food_cost_percentage"]) if settings and settings.get("food_cost_percentage") is not None else None
    report["financials"].update({"average_spend_per_cover":float(settings["average_spend_per_cover"]) if settings and settings.get("average_spend_per_cover") is not None else None,
        "food_cost_percentage":food_pct, "estimated_labour_cost":labour, **totals})
    mapping={"same_day_average":"same_day_avg_7","walk_in_average":"walk_in_avg_7","advance_booking_average":"advance_avg_7","average_booking_duration":"duration_avg_7"}
    for target,source in mapping.items(): report["booking_mix_reference"][target]=_round(mean(feature_values[source])) if feature_values[source] else None
    if any(report["booking_mix_reference"][k] is None for k in mapping): warnings.append({"code":"BOOKING_REFERENCE_INCOMPLETE","message":"Some historical booking reference values are unavailable."})
    report["warnings"]=deduplicate_warnings(warnings); report["operational_insights"]=generate_report_insights(report)
    return report
