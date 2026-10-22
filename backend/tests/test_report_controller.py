from app import create_app
from app.services.report_contract import empty_management_report
from app.services.report_service import generate_management_report

import pytest


def test_report_endpoint_requires_authentication():
    response=create_app().test_client().get("/api/reports/management?selected_date=2026-08-11")
    assert response.status_code==401


def test_report_validation_error_uses_shared_shape(monkeypatch):
    monkeypatch.setattr("app.middleware.auth_middleware.decode_user_token",lambda token:{"user":{"id":1,"role":"manager"}})
    response=create_app().test_client().get("/api/reports/management?selected_date=bad&days_ahead=8",headers={"Authorization":"Bearer valid"})
    assert response.status_code==400
    assert response.get_json()["error"]["code"]=="INVALID_REPORT_PARAMETERS"


@pytest.mark.parametrize(
    ("suffix", "content_type"),
    [("", "application/json"), ("/csv", "text/csv"), ("/pdf", "application/pdf")],
)
def test_report_responses_expose_timing_without_caching(monkeypatch, suffix, content_type):
    monkeypatch.setattr(
        "app.middleware.auth_middleware.decode_user_token",
        lambda token: {"user": {"id": 1, "role": "manager"}},
    )
    report = empty_management_report()
    report["metadata"].update({
        "selected_date": "2026-08-11", "start_date": "2026-08-12",
        "end_date": "2026-08-18", "generated_at": "2026-08-11T12:00:00Z",
        "restaurant_name": "Rosmarino", "restaurant_city": "London",
    })
    monkeypatch.setattr(
        "app.controllers.report_controller.generate_management_report",
        lambda **params: report,
    )

    response = create_app().test_client().get(
        f"/api/reports/management{suffix}?selected_date=2026-08-11&days_ahead=7",
        headers={"Authorization": "Bearer valid"},
    )

    assert response.status_code == 200
    assert response.content_type.startswith(content_type)
    assert response.headers["Cache-Control"] == "no-store"
    assert response.headers["Server-Timing"].startswith("report;dur=")
    assert ", render;dur=" in response.headers["Server-Timing"]


@pytest.mark.parametrize("suffix", ["", "/csv", "/pdf"])
def test_report_routes_never_fetch_optional_providers(monkeypatch, suffix, weather_environment):
    for name, value in weather_environment.items():
        monkeypatch.setenv(name, value)
    monkeypatch.setattr(
        "app.middleware.auth_middleware.decode_user_token",
        lambda token: {"user": {"id": 1, "role": "manager"}},
    )
    monkeypatch.setattr(
        "requests.get",
        lambda *args, **kwargs: pytest.fail("Reports must not make network requests"),
    )
    rows = [
        {"date": f"2026-08-{12 + day:02d}", "day_of_week": "Wednesday",
         "predicted_total_covers": 20, "input_features": {}}
        for day in range(7)
    ]
    monkeypatch.setattr(
        "app.controllers.report_controller.generate_management_report",
        lambda **params: generate_management_report(
            **params, predictor=lambda **kwargs: {"forecast": rows},
            internal_loader=lambda: ([], {}, None),
        ),
    )

    response = create_app().test_client().get(
        f"/api/reports/management{suffix}?selected_date=2026-08-11&days_ahead=7",
        headers={"Authorization": "Bearer valid"},
    )

    assert response.status_code == 200
    if not suffix:
        warnings = {warning["code"] for warning in response.get_json()["warnings"]}
        assert {"WEATHER_UNAVAILABLE", "EVENTS_UNAVAILABLE"} <= warnings
