from datetime import datetime, timedelta, timezone

import pytest

from app import create_app
from app.services import notification_service
from app.services import report_history_service


@pytest.mark.parametrize("method,path", [
    ("get", "/api/notifications/"),
    ("patch", "/api/notifications/3/read"),
])
def test_inbox_requires_authentication(method, path):
    response = getattr(create_app().test_client(), method)(path)
    assert response.status_code == 401


def test_inbox_uses_authenticated_recipient_and_is_not_cached(monkeypatch):
    monkeypatch.setattr("app.middleware.auth_middleware.decode_user_token", lambda token: {"user": {"id": 7, "role": "staff"}})
    seen = []
    monkeypatch.setattr("app.api.notification_route.list_notifications", lambda recipient_id: (seen.append(recipient_id) or {"notifications": [], "unread_count": 0}))
    response = create_app().test_client().get("/api/notifications/", headers={"Authorization": "Bearer valid"})
    assert response.status_code == 200
    assert response.get_json() == {"notifications": [], "unread_count": 0}
    assert response.headers["Cache-Control"] == "no-store"
    assert seen == [7]


def test_mark_read_cannot_address_another_recipient(monkeypatch):
    monkeypatch.setattr("app.middleware.auth_middleware.decode_user_token", lambda token: {"user": {"id": 7, "role": "staff"}})
    seen = []
    monkeypatch.setattr("app.api.notification_route.mark_notification_read", lambda recipient_id, notification_id: (seen.append((recipient_id, notification_id)) or None))
    response = create_app().test_client().patch("/api/notifications/42/read", headers={"Authorization": "Bearer valid"})
    assert response.status_code == 404
    assert seen == [(7, 42)]


class FakeResult:
    def __init__(self, value):
        self.value = value

    def mappings(self):
        return self

    def all(self):
        return self.value

    def one_or_none(self):
        return self.value

    def one(self):
        return self.value

    def scalar_one(self):
        return self.value


class FakeSession:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.calls = []
        self.committed = False

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return None

    def execute(self, statement, params=None):
        self.calls.append((str(statement), params))
        return FakeResult(next(self.responses))

    def commit(self):
        self.committed = True


def test_report_saved_event_is_deduplicated_and_scoped():
    session = FakeSession([None])
    notification_service.create_report_saved_notification(session, 7, 31, "2026-10-30")
    sql, params = session.calls[0]
    assert "ON CONFLICT (dedupe_key) DO NOTHING" in sql
    assert params["recipient_id"] == 7
    assert params["report_id"] == 31
    assert params["dedupe_key"] == "report_saved:31:7"


def test_list_is_bounded_and_user_scoped(monkeypatch):
    now = datetime(2026, 10, 30, tzinfo=timezone.utc)
    session = FakeSession([None, [{"id": 1, "event_type": "report_saved", "source_id": 31,
                                  "title": "Management report saved", "body": "Ready",
                                  "created_at": now, "read_at": None}], 1])
    monkeypatch.setattr(notification_service, "SessionLocal", lambda: session)
    result = notification_service.list_notifications(7)
    assert result["unread_count"] == 1
    assert result["notifications"][0]["read_at"] is None
    assert session.calls[1][1] == {"recipient_id": 7, "limit": 20}
    assert session.calls[2][1] == {"recipient_id": 7}
    assert session.committed


def test_mark_read_filters_by_owner(monkeypatch):
    now = datetime(2026, 10, 30, tzinfo=timezone.utc)
    session = FakeSession([{"id": 31, "read_at": now}])
    monkeypatch.setattr(notification_service, "SessionLocal", lambda: session)
    assert notification_service.mark_notification_read(7, 31) == {"id": 31, "read_at": now.isoformat()}
    sql, params = session.calls[0]
    assert "recipient_id = :recipient_id" in sql
    assert params == {"recipient_id": 7, "notification_id": 31}


def test_report_save_and_notification_share_one_transaction(monkeypatch):
    now = datetime(2026, 10, 30, tzinfo=timezone.utc)
    session = FakeSession([None, {"id": 31, "created_at": now, "expires_at": now + timedelta(days=90)}, None])
    monkeypatch.setattr(report_history_service, "SessionLocal", lambda: session)
    report = {"metadata": {"selected_date": "2026-10-30", "days_ahead": 7,
                           "start_date": "2026-10-31", "end_date": "2026-11-06",
                           "generated_at": now.isoformat()}}
    saved = report_history_service.save_report(report, b"pdf", b"csv", 7)
    assert saved["id"] == 31
    assert "INSERT INTO public.report_history" in session.calls[1][0]
    assert "INSERT INTO public.in_app_notifications" in session.calls[2][0]
    assert session.committed
