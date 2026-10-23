from datetime import date, timedelta

import pytest

from app import create_app
from app.services import staff_cost_service as service


def _prediction(count=7):
    base = date(2026, 10, 22)
    return {
        "model": "random_forest",
        "model_version": "a" * 64,
        "selected_date": base.isoformat(),
        "forecast": [
            {"date": (base + timedelta(days=index)).isoformat(),
             "predicted_total_covers": 42, "closed": False}
            for index in range(1, count + 1)
        ],
    }


class FakeResult:
    def __init__(self, rows=None, scalar=None):
        self.rows = rows or []
        self.scalar = scalar

    def mappings(self):
        return self

    def all(self):
        return self.rows

    def scalar_one(self):
        return self.scalar


class FakeDB:
    def __init__(self, fail_day=False, no_rules=False):
        self.statements = []
        self.committed = False
        self.rolled_back = False
        self.fail_day = fail_day
        self.no_rules = no_rules

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def execute(self, query, params=None):
        statement = str(query)
        self.statements.append(statement)
        if self.fail_day and "INSERT INTO public.forecast_run_days" in statement:
            raise RuntimeError("database write failed")
        if "FROM public.staffing_rules" in statement:
            return FakeResult([] if self.no_rules else [{
                "id": 1, "min_covers": 0, "max_covers": 100,
                "kitchen_staff": 1, "floor_staff": 0,
                "bar_staff": 0, "supervisor_staff": 0,
            }])
        if "FROM public.staff_roles" in statement:
            return FakeResult([{
                "role_name": "Chef", "department": "Kitchen",
                "hourly_rate": 12, "standard_shift_hours": 8,
            }])
        if "INSERT INTO public.forecast_runs" in statement:
            return FakeResult(scalar=41)
        return FakeResult()

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True


def test_partial_prediction_never_opens_a_transaction(monkeypatch):
    monkeypatch.setattr(service, "prediction_demand", lambda **_kwargs: _prediction(6))
    monkeypatch.setattr(service, "SessionLocal", lambda: pytest.fail("Unexpected database write"))
    with pytest.raises(service.ForecastRunError, match="incomplete"):
        service.generate_staff_cost_forecast()


def test_nonconsecutive_or_invalid_prediction_never_writes(monkeypatch):
    malformed = _prediction()
    malformed["forecast"][2]["date"] = "2026-11-01"
    monkeypatch.setattr(service, "prediction_demand", lambda **_kwargs: malformed)
    monkeypatch.setattr(service, "SessionLocal", lambda: pytest.fail("Unexpected database write"))
    with pytest.raises(service.ForecastRunError, match="incomplete"):
        service.generate_staff_cost_forecast()


def test_complete_run_is_inserted_before_activation_without_deletes(monkeypatch):
    db = FakeDB()
    monkeypatch.setattr(service, "prediction_demand", lambda **_kwargs: _prediction())
    monkeypatch.setattr(service, "SessionLocal", lambda: db)
    result = service.generate_staff_cost_forecast()
    statements = db.statements
    assert result["run_id"] == 41
    assert len([sql for sql in statements if "INSERT INTO public.forecast_run_days" in sql]) == 7
    assert len([sql for sql in statements if "INSERT INTO public.staff_cost_forecast" in sql]) == 7
    assert statements.index(next(sql for sql in statements if "INSERT INTO public.forecast_runs" in sql)) < statements.index(next(sql for sql in statements if "INSERT INTO public.active_forecast_run" in sql))
    assert statements[-1].find("INSERT INTO public.active_forecast_run") >= 0
    assert not any("DELETE FROM" in sql for sql in statements)
    assert db.committed and not db.rolled_back


def test_failed_day_write_rolls_back_without_activation(monkeypatch):
    db = FakeDB(fail_day=True)
    monkeypatch.setattr(service, "prediction_demand", lambda **_kwargs: _prediction())
    monkeypatch.setattr(service, "SessionLocal", lambda: db)
    with pytest.raises(RuntimeError, match="database write failed"):
        service.generate_staff_cost_forecast()
    assert db.rolled_back and not db.committed
    assert not any("INSERT INTO public.active_forecast_run" in sql for sql in db.statements)


def test_missing_staffing_rule_rolls_back_without_activation(monkeypatch):
    db = FakeDB(no_rules=True)
    monkeypatch.setattr(service, "prediction_demand", lambda **_kwargs: _prediction())
    monkeypatch.setattr(service, "SessionLocal", lambda: db)
    with pytest.raises(service.ForecastRunError, match="No staffing rule"):
        service.generate_staff_cost_forecast()
    assert db.rolled_back and not db.committed
    assert not any("INSERT INTO public.active_forecast_run" in sql for sql in db.statements)


def test_forecast_creation_requires_post_and_authentication():
    client = create_app().test_client()
    assert client.post("/api/staff-cost/forecast").status_code == 401
    assert client.get("/api/staff-cost/forecast").status_code in (401, 405)


def test_authorized_run_history_is_readable(monkeypatch):
    monkeypatch.setattr(
        "app.middleware.auth_middleware.decode_user_token",
        lambda _token: {"user": {"id": 7, "role": "manager"}},
    )
    monkeypatch.setattr(
        "app.controllers.staff_cost_controller.list_forecast_runs",
        lambda: [{"id": 41, "active": False}, {"id": 42, "active": True}],
    )
    monkeypatch.setattr(
        "app.controllers.staff_cost_controller.get_forecast_run",
        lambda run_id: {"id": run_id, "prediction": {"forecast": []}},
    )
    client = create_app().test_client()
    headers = {"Authorization": "Bearer valid"}
    listing = client.get("/api/staff-cost/runs", headers=headers)
    assert listing.status_code == 200
    assert [run["id"] for run in listing.get_json()["runs"]] == [41, 42]
    assert listing.headers["Cache-Control"] == "no-store"
    assert client.get("/api/staff-cost/runs/41", headers=headers).get_json()["id"] == 41
