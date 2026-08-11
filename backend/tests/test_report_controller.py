from app import create_app


def test_report_endpoint_requires_authentication():
    response=create_app().test_client().get("/api/reports/management?selected_date=2026-08-11")
    assert response.status_code==401


def test_report_validation_error_uses_shared_shape(monkeypatch):
    monkeypatch.setattr("app.middleware.auth_middleware.decode_user_token",lambda token:{"user":{"id":1}})
    response=create_app().test_client().get("/api/reports/management?selected_date=bad&days_ahead=8",headers={"Authorization":"Bearer valid"})
    assert response.status_code==400
    assert response.get_json()["error"]["code"]=="INVALID_REPORT_PARAMETERS"
