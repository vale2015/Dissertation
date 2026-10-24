from datetime import date, datetime, timezone

import pytest

from app import create_app
from app.services import forecast_accuracy_service as service


class FakeResult:
    def __init__(self, rows=None):
        self.rows = rows or []

    def mappings(self):
        return self

    def all(self):
        return self.rows

    def first(self):
        return self.rows[0] if self.rows else None


class FakeDB:
    def __init__(self, rows=None):
        self.rows = rows or []
        self.statements = []
        self.committed = False

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def execute(self, query, params=None):
        statement = str(query)
        self.statements.append((statement, params))
        if "WITH original AS" in statement:
            return FakeResult(self.rows)
        if "INSERT INTO public.service_actual_covers" in statement:
            return FakeResult([{"service_date": params["service_date"]}])
        if "SELECT actual_covers FROM public.service_actual_covers" in statement:
            return FakeResult([{"actual_covers": 37}])
        return FakeResult()

    def commit(self):
        self.committed = True


def test_actuals_require_past_date_and_integer_covers(monkeypatch):
    monkeypatch.setattr(service, "_today", lambda: date(2026, 10, 24))
    for value in ("2026-10-24", "2026-10-25", "20261023", "bad"):
        with pytest.raises(service.AccuracyInputError):
            service._validate_actual(value, 12)
    for value in (True, -1, 1.5, 100001):
        with pytest.raises(service.AccuracyInputError):
            service._validate_actual("2026-10-23", value)
    assert service._validate_actual("2026-10-23", 0) == date(2026, 10, 23)


def test_accuracy_uses_original_preservice_open_snapshot_and_real_actuals(monkeypatch):
    monkeypatch.setattr(service, "_today", lambda: date(2026, 10, 24))
    db = FakeDB([
        {"forecast_date": date(2026, 10, 23), "predicted_covers": 50,
         "day_index": 2, "run_id": 3, "generated_at": datetime(2026, 10, 21, tzinfo=timezone.utc),
         "model_version": "abc", "actual_covers": 40, "booked_covers": 35},
        {"forecast_date": date(2026, 10, 22), "predicted_covers": 20,
         "day_index": 1, "run_id": 2, "generated_at": datetime(2026, 10, 20, tzinfo=timezone.utc),
         "model_version": "abc", "actual_covers": 0, "booked_covers": 12},
        {"forecast_date": date(2026, 10, 21), "predicted_covers": 30,
         "day_index": 1, "run_id": 1, "generated_at": datetime(2026, 10, 20, tzinfo=timezone.utc),
         "model_version": "abc", "actual_covers": None, "booked_covers": 25},
    ])
    monkeypatch.setattr(service, "SessionLocal", lambda: db)
    report = service.get_accuracy_report(30)
    sql, params = db.statements[0]
    assert "DISTINCT ON (d.forecast_date)" in sql
    assert "d.closed = false" in sql
    assert "r.generated_at < (d.forecast_date::timestamp AT TIME ZONE 'Europe/London')" in sql
    assert params["today"] == date(2026, 10, 24)
    assert report["summary"] == {
        "evaluated_days": 2, "mean_absolute_error": 15.0,
        "mean_absolute_percentage_error": 25.0, "mean_bias": 15.0,
        "zero_actual_days_excluded_from_mape": 1,
    }
    assert report["awaiting_actual_days"] == 1
    assert report["days"][0]["actual_covers"] == 40
    assert report["days"][0]["booked_covers"] == 35
    assert report["by_lead_days"][1]["lead_days"] == 2


def test_record_actual_requires_eligible_forecast_and_does_not_overwrite(monkeypatch):
    monkeypatch.setattr(service, "_today", lambda: date(2026, 10, 24))
    db = FakeDB()
    monkeypatch.setattr(service, "SessionLocal", lambda: db)
    monkeypatch.setattr(service, "_eligible_forecast", lambda *_args: None)
    with pytest.raises(service.AccuracyInputError, match="eligible"):
        service.record_actual("2026-10-23", 38, 7)
    assert not db.statements
    monkeypatch.setattr(service, "_eligible_forecast", lambda *_args: {"run_id": 3})
    assert service.record_actual("2026-10-23", 38, 7)["actual_covers"] == 38
    assert db.committed
    assert "ON CONFLICT (service_date) DO NOTHING" in db.statements[0][0]


def test_correction_keeps_audit_record_in_same_transaction(monkeypatch):
    monkeypatch.setattr(service, "_today", lambda: date(2026, 10, 24))
    db = FakeDB()
    monkeypatch.setattr(service, "SessionLocal", lambda: db)
    service.correct_actual("2026-10-23", 39, "Count correction", 7)
    assert db.committed
    assert "FOR UPDATE" in db.statements[0][0]
    assert "INSERT INTO public.service_actual_corrections" in db.statements[1][0]
    assert db.statements[1][1]["previous"] == 37
    assert "UPDATE public.service_actual_covers" in db.statements[2][0]
    with pytest.raises(service.AccuracyInputError, match="differ"):
        service.correct_actual("2026-10-23", 37, "Count correction", 7)


def test_accuracy_routes_require_auth_and_booking_permission(monkeypatch):
    client = create_app().test_client()
    assert client.get("/api/staff-cost/accuracy").status_code == 401
    assert client.post("/api/staff-cost/actuals", json={}).status_code == 401
    monkeypatch.setattr("app.middleware.auth_middleware.decode_user_token",
                        lambda _token: {"user": {"id": 7, "role": "manager"}})
    monkeypatch.setattr("app.controllers.forecast_accuracy_controller.get_accuracy_report",
                        lambda days: {"window_days": days, "days": []})
    monkeypatch.setattr("app.controllers.forecast_accuracy_controller.record_actual",
                        lambda *_args: {"service_date": "2026-10-23", "actual_covers": 38})
    headers = {"Authorization": "Bearer valid"}
    response = client.get("/api/staff-cost/accuracy?days=30", headers=headers)
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    assert response.get_json()["window_days"] == 30
    assert client.get("/api/staff-cost/accuracy?days=999", headers=headers).status_code == 400
    assert client.post("/api/staff-cost/actuals", headers=headers,
                       json={"service_date": "2026-10-23", "actual_covers": 38}).status_code == 201
    monkeypatch.setattr("app.middleware.auth_middleware.decode_user_token",
                        lambda _token: {"user": {"id": 8, "role": "staff"}})
    assert client.get("/api/staff-cost/accuracy", headers=headers).status_code == 403
    assert client.post("/api/staff-cost/actuals", headers=headers, json={}).status_code == 403
