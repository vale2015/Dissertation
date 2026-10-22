import json
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import pytest
from app.services.report_service import generate_management_report
from app.services.events_service import _clear_events_cache


def forecast(days=7):
    return {"forecast":[{"date":f"2026-08-{12+i:02d}","day_of_week":"Wednesday","closed":i==1,
        "holiday_name":None,"closure_reason":"Weekly closure" if i==1 else None,"predicted_total_covers":0 if i==1 else 20+i,
        "input_features":{"same_day_avg_7":3,"walk_in_avg_7":4,"advance_avg_7":5,"duration_avg_7":90}} for i in range(days)]}


def internal():
    return ([{"min_covers":0,"max_covers":100,"kitchen_staff":1,"floor_staff":2,"bar_staff":1,"supervisor_staff":1}],
        {("Chef","Kitchen"):{"role_name":"Chef","department":"Kitchen","hourly_rate":12,"standard_shift_hours":8},
         ("Waiter","Floor"):{"role_name":"Waiter","department":"Floor","hourly_rate":11,"standard_shift_hours":8},
         ("Bartender","Bar"):{"role_name":"Bartender","department":"Bar","hourly_rate":11,"standard_shift_hours":8},
         ("Supervisor","Management"):{"role_name":"Supervisor","department":"Management","hourly_rate":15,"standard_shift_hours":8}},
        {"average_spend_per_cover":30,"food_cost_percentage":30})


@pytest.mark.parametrize("days",[7,10])
def test_report_is_canonical_serializable_and_calls_prediction_once(days):
    calls=[]
    report=generate_management_report("2026-08-11",days,predictor=lambda **kw:(calls.append(kw) or forecast(days)),
        internal_loader=internal,weather_loader=lambda:{"daily_forecast":[]},events_loader=lambda *args:{"days":[]})
    assert len(calls)==1 and len(report["daily_breakdown"])==days
    assert report["summary"]["closed_days"]==1
    assert report["daily_breakdown"][1]["estimated_labour_cost"]==0
    assert report["financials"]["estimated_revenue"]==report["summary"]["forecasted_covers"]*30
    assert "customer_name" not in json.dumps(report)


def test_optional_provider_failures_do_not_block_report():
    def fail(*args): raise RuntimeError
    report=generate_management_report("2026-08-11",7,predictor=lambda **kw:forecast(),internal_loader=internal,weather_loader=fail,events_loader=fail)
    assert {w["code"] for w in report["warnings"]}>={"WEATHER_UNAVAILABLE","EVENTS_UNAVAILABLE"}


def test_stale_optional_context_is_visible_in_report_warnings():
    report = generate_management_report(
        "2026-08-11", 7,
        predictor=lambda **_: forecast(),
        internal_loader=internal,
        weather_loader=lambda: {"daily_forecast": [], "stale": True,
                                "warning": "Weather information may be out of date."},
        events_loader=lambda *_: {"days": [], "stale": True,
                                 "warning": "Local-event information may be out of date."},
    )
    assert {warning["code"] for warning in report["warnings"]} >= {
        "WEATHER_STALE", "EVENTS_STALE"
    }


def test_report_cache_miss_never_calls_optional_providers(monkeypatch, weather_environment):
    for name, value in weather_environment.items():
        monkeypatch.setenv(name, value)
    monkeypatch.setenv("TICKETMASTER_API_KEY", "test-key")
    monkeypatch.setenv("RESTAURANT_COUNTRY_CODE", "GB")
    _clear_events_cache()
    monkeypatch.setattr(
        "app.services.weather_service.fetch_open_meteo_weather",
        lambda *_: pytest.fail("Report must not fetch weather"),
    )
    monkeypatch.setattr(
        "app.services.events_service.fetch_ticketmaster_events",
        lambda *_: pytest.fail("Report must not fetch events"),
    )

    today = datetime.now(ZoneInfo("Europe/London")).date()
    rows = forecast()["forecast"]
    for index, row in enumerate(rows):
        row["date"] = (today + timedelta(days=index + 1)).isoformat()
    report = generate_management_report(
        today.isoformat(), 7,
        predictor=lambda **_: {"forecast": rows},
        internal_loader=internal,
    )

    assert report["summary"]["forecasted_covers"] > 0
    assert report["data_sources"]["weather"]["available"] is False
    assert report["data_sources"]["events"]["available"] is False
    assert {warning["code"] for warning in report["warnings"]} >= {
        "WEATHER_UNAVAILABLE", "EVENTS_UNAVAILABLE"
    }
