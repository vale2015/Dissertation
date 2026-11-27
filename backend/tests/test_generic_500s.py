"""#76: unexpected exceptions return a generic 500; details are logged only (synthetic data)."""
import logging

import pytest

import app.controllers.booking_controller as booking_controller
import app.controllers.dashboard_controller as dashboard_controller
import app.controllers.demand_controller as demand_controller
import app.controllers.staff_cost_controller as staff_cost_controller
import app.controllers.staffing_rules_controller as staffing_rules_controller
import app.middleware.auth_middleware as auth_middleware
from app import create_app

SENTINEL = "SENTINEL-db-password-leak-76"


def boom(*args, **kwargs):
    raise RuntimeError(SENTINEL)


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(
        auth_middleware, "decode_user_token",
        lambda token: {"user": {"id": 1, "role": "manager"}},
    )
    return create_app().test_client()


H = {"Authorization": "Bearer manager"}
DEMAND_BODY = {"date": "2026-01-05", "same_day_covers": 1, "walk_in_covers": 1,
               "advance_covers": 1, "avg_duration_min": 60}

CASES = [
    (demand_controller, "get_all_demand_records", "get", "/api/demand/", None),
    (demand_controller, "get_latest_demand_record", "get", "/api/demand/latest", None),
    (demand_controller, "insert_demand_record", "post", "/api/demand/", DEMAND_BODY),
    (demand_controller, "get_demand_statistics", "get", "/api/demand/stats", None),
    (demand_controller, "get_demand_record_by_date", "get", "/api/demand/date/2026-01-05", None),
    (demand_controller, "delete_demand_record", "delete", "/api/demand/date/2026-01-05", None),
    (demand_controller, "get_weekly_demand_summary", "get", "/api/demand/weekly", None),
    (dashboard_controller, "get_dashboard_summary", "get", "/api/dashboard/", None),
    (staffing_rules_controller, "get_all_staffing_rules_service", "get", "/api/staffing-rules/", None),
    (staff_cost_controller, "get_all_staff_cost_forecast_records", "get", "/api/staff-cost/", None),
    (staff_cost_controller, "get_staff_cost_forecast_by_date_service", "get", "/api/staff-cost/date/2026-01-05", None),
]


@pytest.mark.parametrize("module,attr,method,url,body", CASES)
def test_unexpected_error_is_generic_and_logged(client, monkeypatch, caplog, module, attr, method, url, body):
    monkeypatch.setattr(module, attr, boom)
    with caplog.at_level(logging.ERROR):
        response = getattr(client, method)(url, json=body, headers=H) if body else getattr(client, method)(url, headers=H)
    assert response.status_code == 500
    assert SENTINEL not in response.get_data(as_text=True)
    assert response.get_json()["code"] == "INTERNAL_ERROR"
    assert any(SENTINEL in (r.exc_text or "") or (r.exc_info and SENTINEL in str(r.exc_info[1]))
               for r in caplog.records)


def test_domain_4xx_messages_unchanged(client):
    response = client.post("/api/demand/", json={"date": "2026-01-05"}, headers=H)
    assert response.status_code == 400
    assert response.get_json() == {"error": "Missing field: same_day_covers"}
