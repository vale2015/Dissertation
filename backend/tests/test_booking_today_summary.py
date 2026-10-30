from datetime import date

from app import create_app
from app.services import booking_service


class Result:
    def __init__(self, value):
        self.value = value

    def mappings(self):
        return self

    def one(self):
        return self.value

    def all(self):
        return self.value


class Connection:
    def __init__(self):
        self.calls = []

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return None

    def execute(self, statement, params):
        self.calls.append((str(statement), params))
        return Result({"booking_count": 2, "booked_covers": 5} if len(self.calls) == 1 else [
            {"id": 1, "booking_time": None, "party_size": 2, "booking_type": "advance"},
            {"id": 2, "booking_time": None, "party_size": 3, "booking_type": "same_day"},
        ])


def test_today_summary_queries_only_current_london_date_and_bounds_rows(monkeypatch):
    connection = Connection()
    monkeypatch.setattr(booking_service.engine, "connect", lambda: connection)
    result = booking_service.fetch_todays_bookings_summary_service()
    assert result["booking_count"] == 2
    assert result["booked_covers"] == 5
    assert len(result["bookings"]) == 2
    assert connection.calls[0][1]["today"] == date.fromisoformat(result["date"])
    assert "booking_date = :today" in connection.calls[0][0]
    assert "LIMIT 10" in connection.calls[1][0]


def test_today_summary_requires_booking_permission(monkeypatch):
    monkeypatch.setattr("app.middleware.auth_middleware.decode_user_token", lambda token: {"user": {"id": 8, "role": "staff"}})
    response = create_app().test_client().get("/api/booking/today-summary", headers={"Authorization": "Bearer valid"})
    assert response.status_code == 403
