from datetime import date, datetime

import pytest

from app import create_app
from app.services.report_history_service import (
    ReportHistoryError, _decode_cursor, _encode_cursor, create_download_token,
    save_report, valid_download_token,
)


@pytest.fixture
def manager_client(monkeypatch):
    monkeypatch.setattr(
        "app.middleware.auth_middleware.decode_user_token",
        lambda token: {"user": {"id": 7, "role": "manager"}},
    )
    return create_app().test_client()


@pytest.mark.parametrize("method,path", [
    ("post", "/api/reports/history"),
    ("get", "/api/reports/history"),
    ("get", "/api/reports/history/1"),
    ("post", "/api/reports/history/1/download-link"),
    ("get", "/api/reports/history/1/pdf"),
])
def test_history_requires_authentication(method, path):
    response = getattr(create_app().test_client(), method)(path)
    assert response.status_code == 401


def test_staff_cannot_access_history(monkeypatch):
    monkeypatch.setattr(
        "app.middleware.auth_middleware.decode_user_token",
        lambda token: {"user": {"id": 8, "role": "staff"}},
    )
    response = create_app().test_client().get(
        "/api/reports/history", headers={"Authorization": "Bearer valid"}
    )
    assert response.status_code == 403


def test_save_generates_trusted_snapshot_and_files(manager_client, monkeypatch):
    seen = {}
    monkeypatch.setattr(
        "app.controllers.report_history_controller.generate_management_report",
        lambda **params: {"metadata": params},
    )
    monkeypatch.setattr(
        "app.controllers.report_history_controller.generate_report_pdf", lambda report: b"%PDF-1.4"
    )
    monkeypatch.setattr(
        "app.controllers.report_history_controller.generate_report_csv", lambda report: b"a,b\r\n"
    )

    def fake_save(report, pdf_file, csv_file, actor_id):
        seen.update({"report": report, "pdf": pdf_file, "csv": csv_file, "actor": actor_id})
        return {"id": 1, "expires_at": "2027-01-20T00:00:00Z"}

    monkeypatch.setattr("app.controllers.report_history_controller.save_report", fake_save)
    response = manager_client.post(
        "/api/reports/history", json={"selected_date": "2026-10-22", "days_ahead": 7,
                                       "snapshot": {"forged": True}},
        headers={"Authorization": "Bearer valid"},
    )
    assert response.status_code == 201
    assert response.headers["Cache-Control"] == "no-store"
    assert seen == {"report": {"metadata": {"selected_date": "2026-10-22", "days_ahead": 7}},
                    "pdf": b"%PDF-1.4", "csv": b"a,b\r\n", "actor": 7}


def test_save_rejects_invalid_parameters(manager_client):
    response = manager_client.post(
        "/api/reports/history", json={"selected_date": "bad", "days_ahead": 15},
        headers={"Authorization": "Bearer valid"},
    )
    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "INVALID_REPORT_PARAMETERS"


def test_list_and_snapshot_are_not_cached(manager_client, monkeypatch):
    monkeypatch.setattr(
        "app.controllers.report_history_controller.list_reports",
        lambda cursor: {"reports": [{"id": 1}], "next_cursor": None},
    )
    monkeypatch.setattr(
        "app.controllers.report_history_controller.get_report",
        lambda report_id: {"metadata": {"selected_date": "2026-10-22"}},
    )
    headers = {"Authorization": "Bearer valid"}
    for path in ("/api/reports/history", "/api/reports/history/1"):
        response = manager_client.get(path, headers=headers)
        assert response.status_code == 200
        assert response.headers["Cache-Control"] == "no-store"


def test_download_link_is_bound_to_user_report_and_format(manager_client, monkeypatch):
    monkeypatch.setattr("app.services.report_history_service.get_secret_key", lambda: "test-secret")
    monkeypatch.setattr("app.controllers.report_history_controller.report_exists", lambda report_id: True)
    monkeypatch.setattr(
        "app.controllers.report_history_controller.get_report_file",
        lambda report_id, format_name: {"selected_date": date(2026, 10, 22),
                                         "days_ahead": 7, "content": b"%PDF-1.4"},
    )
    headers = {"Authorization": "Bearer valid"}
    link = manager_client.post(
        "/api/reports/history/1/download-link", json={"format": "pdf"}, headers=headers
    )
    assert link.status_code == 200
    assert link.headers["Cache-Control"] == "no-store"
    url = link.get_json()["url"].replace("/api/backend", "/api", 1)
    download = manager_client.get(url, headers=headers)
    assert download.status_code == 200
    assert download.data == b"%PDF-1.4"
    assert download.headers["Cache-Control"] == "no-store"
    assert manager_client.get(url.replace("/1/pdf", "/2/pdf"), headers=headers).status_code == 403
    assert manager_client.get(url.replace("/pdf?", "/csv?"), headers=headers).status_code == 403
    assert manager_client.get("/api/reports/history/1/pdf", headers=headers).status_code == 403


def test_cursor_validation_and_token_expiration(monkeypatch):
    row = {"id": 3, "created_at": datetime.fromisoformat("2026-10-22T12:00:00+00:00")}
    assert _decode_cursor(_encode_cursor(row)) == (row["created_at"], 3)
    with pytest.raises(ReportHistoryError):
        _decode_cursor("not-a-valid-cursor")
    with pytest.raises(ReportHistoryError):
        _decode_cursor("a" * 513)
    monkeypatch.setattr("app.services.report_history_service.get_secret_key", lambda: "test-secret")
    token = create_download_token(1, "pdf", 7)
    assert valid_download_token(token, 1, "pdf", 7)
    assert not valid_download_token(token, 1, "pdf", 8)
    assert not valid_download_token(token + "invalid", 1, "pdf", 7)
    monkeypatch.setattr("app.services.report_history_service.DOWNLOAD_TOKEN_SECONDS", -1)
    assert not valid_download_token(token, 1, "pdf", 7)


def test_saved_report_files_are_size_bounded():
    with pytest.raises(ReportHistoryError):
        save_report({"metadata": {}}, b"x" * 262145, b"a", 7)
