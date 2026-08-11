from datetime import datetime
from zoneinfo import ZoneInfo

from app.services.additional_events_service import (
    fetch_bandsintown_events,
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
        "bandsintown_app_id": "rfs-test",
        "bandsintown_artists": ["Example Artist"],
        "sportsdb_enabled": True,
        "sportsdb_api_key": "123",
    }
    return configuration, {"supported_dates": [today]}


def test_bandsintown_normalises_a_configured_artist(monkeypatch):
    configuration, date_range = _inputs()
    monkeypatch.setattr(
        "app.services.additional_events_service.requests.get",
        lambda *args, **kwargs: FakeResponse([
            {
                "id": "show-1",
                "datetime": f'{date_range["supported_dates"][0]}T19:30:00',
                "url": "https://www.bandsintown.com/e/show-1",
                "lineup": ["Example Artist"],
                "venue": {
                    "name": "Local Hall", "city": "London",
                    "latitude": "51.45", "longitude": "-0.15",
                },
            }
        ]),
    )
    events, warning = fetch_bandsintown_events(configuration, date_range)
    assert warning is None
    assert events[0]["provider"] == "Bandsintown"
    assert events[0]["event_type"] == "concerts"


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
    configuration["bandsintown_app_id"] = ""
    configuration["sportsdb_enabled"] = False
    assert fetch_bandsintown_events(configuration, date_range) == ([], None)
    assert fetch_sportsdb_events(configuration, date_range) == ([], None)
