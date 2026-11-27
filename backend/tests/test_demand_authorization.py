"""#62: demand writes require manage_demand; reads stay on view_forecasts (synthetic data only)."""
import pytest

import app.controllers.demand_controller as demand_controller
import app.middleware.auth_middleware as auth_middleware
from app import create_app

DEMAND_BODY = {"date": "2026-01-05", "same_day_covers": 10, "walk_in_covers": 4, "advance_covers": 6, "avg_duration_min": 75}


@pytest.fixture
def client(monkeypatch):
    calls = {"insert": 0, "delete": 0, "list": 0}

    def fake_decode(token):
        if token == "missing-role":
            return {"user": {"id": 99}}
        return {"user": {"id": 1, "role": token}}

    def fake_insert(data):
        calls["insert"] += 1
        return {"date": data["date"]}

    def fake_delete(date):
        calls["delete"] += 1
        return 1

    def fake_list():
        calls["list"] += 1
        return [{"date": "2026-01-05"}]

    monkeypatch.setattr(auth_middleware, "decode_user_token", fake_decode)
    monkeypatch.setattr(demand_controller, "insert_demand_record", fake_insert)
    monkeypatch.setattr(demand_controller, "delete_demand_record", fake_delete)
    monkeypatch.setattr(demand_controller, "get_all_demand_records", fake_list)
    test_client = create_app().test_client()
    test_client.calls = calls
    return test_client


def auth(role):
    return {"Authorization": f"Bearer {role}"}


def test_manager_can_create_and_delete_demand(client):
    created = client.post("/api/demand/", json=DEMAND_BODY, headers=auth("manager"))
    deleted = client.delete("/api/demand/date/2026-01-05", headers=auth("manager"))
    assert created.status_code == 201
    assert deleted.status_code == 200
    assert client.calls["insert"] == 1 and client.calls["delete"] == 1


@pytest.mark.parametrize("role", ["supervisor", "staff", "missing-role", "owner"])
def test_non_managers_are_forbidden_from_demand_writes(client, role):
    created = client.post("/api/demand/", json=DEMAND_BODY, headers=auth(role))
    deleted = client.delete("/api/demand/date/2026-01-05", headers=auth(role))
    for response in (created, deleted):
        assert response.status_code == 403
        assert response.get_json()["error"]["code"] == "FORBIDDEN"
    assert client.calls["insert"] == 0 and client.calls["delete"] == 0


@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer "}, {"Authorization": "Basic manager"}])
def test_unauthenticated_demand_writes_return_401(client, headers):
    assert client.post("/api/demand/", json=DEMAND_BODY, headers=headers).status_code == 401
    assert client.delete("/api/demand/date/2026-01-05", headers=headers).status_code == 401
    assert client.calls["insert"] == 0 and client.calls["delete"] == 0


@pytest.mark.parametrize("role", ["manager", "supervisor"])
def test_demand_reads_remain_available_to_forecast_viewers(client, role):
    response = client.get("/api/demand/", headers=auth(role))
    assert response.status_code == 200
    assert response.get_json() == [{"date": "2026-01-05"}]


def test_staff_demand_read_still_forbidden_by_blueprint_guard(client):
    assert client.get("/api/demand/", headers=auth("staff")).status_code == 403
    assert client.calls["list"] == 0
