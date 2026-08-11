from datetime import datetime
from zoneinfo import ZoneInfo

from app.services.additional_events_service import (
    fetch_skiddle_events,
    fetch_sportsdb_events,
)


class FakeResponse:
    def __init__(self, payload, status_code=200):
        self.payload = payload
        self.status_code = status_code

    def json(self):
        return self.payload


def _inputs():
    today = datetime.now(ZoneInfo("Europe/London")).date().isoformat()
    configuration = {
        "latitude": 51.4360997,
        "longitude": -0.1606866,
        "radius_km": 10,
        "city": "London",
        "timezone": "Europe/London",
        "max_results": 100,
        "skiddle_api_key": "private-skiddle-key",
        "sportsdb_enabled": True,
        "sportsdb_api_key": "123",
    }
    return configuration, {"supported_dates": [today]}


def test_skiddle_normalises_all_nearby_events(monkeypatch):
    configuration, date_range = _inputs()
    captured = {}

    def fake_get(*args, **kwargs):
        captured.update(kwargs["params"])
        return FakeResponse({"results": [
                {
                    "id": "show-1", "date": date_range["supported_dates"][0],
                    "eventname": "Example Concert", "eventcode": "LIVE",
                    "link": "https://www.skiddle.com/e/show-1",
                    "openingtimes": {"doorsopen": "19:30:00"},
                    "venue": {
                        "name": "Local Hall", "city": "London",
                        "latitude": "51.45", "longitude": "-0.15",
                    },
                }
            ]})

    monkeypatch.setattr(
        "app.services.additional_events_service.requests.get",
        fake_get,
    )
    events, warning = fetch_skiddle_events(configuration, date_range)
    assert warning is None
    assert events[0]["provider"] == "Skiddle"
    assert events[0]["event_type"] == "concerts"
    assert captured["minDate"] == date_range["supported_dates"][0]
    assert captured["maxDate"] == date_range["supported_dates"][0]
    assert "a" not in captured
    assert "keyword" not in captured


def test_sportsdb_normalises_known_london_venue_without_feed_coordinates(monkeypatch):
    configuration, date_range = _inputs()
    monkeypatch.setattr(
        "app.services.additional_events_service.requests.get",
        lambda *args, **kwargs: FakeResponse({"events": [{
            "idEvent": "sport-1", "strEvent": "London A vs London B",
            "dateEvent": date_range["supported_dates"][0], "strTime": "15:00:00",
            "strVenue": "Stamford Bridge", "strSport": "Soccer",
        }]}),
    )
    events, warning = fetch_sportsdb_events(configuration, date_range)
    assert warning is None
    assert events[0]["provider"] == "TheSportsDB"
    assert events[0]["event_type"] == "sports"


def test_optional_providers_are_disabled_without_configuration():
    configuration, date_range = _inputs()
    configuration["skiddle_api_key"] = ""
    configuration["sportsdb_enabled"] = False
    assert fetch_skiddle_events(configuration, date_range) == ([], None)
    assert fetch_sportsdb_events(configuration, date_range) == ([], None)
