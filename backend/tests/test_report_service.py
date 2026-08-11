import json
import pytest
from app.services.report_service import generate_management_report


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
