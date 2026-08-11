from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
import requests

from app.services.events_service import (
    EventsConfigurationError,
    EventsRequestError,
    EventsProviderError,
    build_daily_event_context,
    _clear_events_cache,
    _events_cache,
    fetch_ticketmaster_events,
    load_events_configuration,
    get_local_events,
    normalise_ticketmaster_events,
    validate_event_date_range,
)


VALID_ENVIRONMENT = {
    "TICKETMASTER_API_KEY": "private-test-key",
    "RESTAURANT_CITY": "London",
    "RESTAURANT_COUNTRY_CODE": "gb",
    "RESTAURANT_LATITUDE": "51.4360997",
    "RESTAURANT_LONGITUDE": "-0.1606866",
    "RESTAURANT_TIMEZONE": "Europe/London",
    "EVENT_SEARCH_RADIUS_KM": "10",
    "EVENTS_CACHE_TTL_SECONDS": "21600",
    "EVENTS_MAX_RESULTS": "100",
    "TICKETMASTER_LOCALE": "en-gb",
}


@pytest.fixture
def event_environment(monkeypatch):
    _clear_events_cache()
    for name, value in VALID_ENVIRONMENT.items():
        monkeypatch.setenv(name, value)
    return monkeypatch


def test_valid_event_configuration_is_typed(event_environment):
    configuration = load_events_configuration()
    assert configuration["api_key"] == "private-test-key"
    assert configuration["country_code"] == "GB"
    assert configuration["radius_km"] == 10.0
    assert configuration["cache_ttl_seconds"] == 21600
    assert configuration["max_results"] == 100
    assert configuration["geo_point"] == "gcpus7duz"


@pytest.mark.parametrize(
    "name,value",
    [
        ("TICKETMASTER_API_KEY", ""),
        ("RESTAURANT_COUNTRY_CODE", "GBR"),
        ("EVENT_SEARCH_RADIUS_KM", "0"),
        ("EVENT_SEARCH_RADIUS_KM", "101"),
        ("EVENTS_CACHE_TTL_SECONDS", "0"),
        ("EVENTS_MAX_RESULTS", "0"),
        ("EVENTS_MAX_RESULTS", "101"),
        ("RESTAURANT_LATITUDE", "invalid"),
    ],
)
def test_invalid_configuration_fails_safely(event_environment, name, value):
    event_environment.setenv(name, value)
    with pytest.raises(EventsConfigurationError) as caught:
        load_events_configuration()
    assert "private-test-key" not in str(caught.value)


def test_default_optional_event_settings(event_environment):
    for name in (
        "EVENT_SEARCH_RADIUS_KM",
        "EVENTS_CACHE_TTL_SECONDS",
        "EVENTS_MAX_RESULTS",
        "TICKETMASTER_LOCALE",
    ):
        event_environment.delenv(name)
    configuration = load_events_configuration()
    assert configuration["radius_km"] == 10.0
    assert configuration["cache_ttl_seconds"] == 21600
    assert configuration["max_results"] == 100
    assert configuration["locale"] == "en-gb"


def _london_today():
    return datetime.now(ZoneInfo("Europe/London")).date()


def test_default_range_contains_seven_days():
    result = validate_event_date_range(None, None, "Europe/London")
    assert len(result["requested_dates"]) == 7
    assert result["start_date"] == _london_today().isoformat()


@pytest.mark.parametrize("length", [7, 10])
def test_supported_range_lengths(length):
    start = _london_today() + timedelta(days=1)
    end = start + timedelta(days=length - 1)
    result = validate_event_date_range(start.isoformat(), end.isoformat(), "Europe/London")
    assert len(result["requested_dates"]) == length
    assert result["contains_past_dates"] is False


@pytest.mark.parametrize(
    "start,end",
    [
        ("not-a-date", "2026-08-20"),
        ("2026-08-20", "2026-08-19"),
        ("2026-08-10", None),
    ],
)
def test_invalid_or_incomplete_ranges_are_rejected(start, end):
    with pytest.raises(EventsRequestError):
        validate_event_date_range(start, end, "Europe/London")


def test_eleven_day_range_is_rejected():
    start = _london_today() + timedelta(days=1)
    with pytest.raises(EventsRequestError):
        validate_event_date_range(
            start.isoformat(),
            (start + timedelta(days=10)).isoformat(),
            "Europe/London",
        )


def test_entirely_historical_range_has_no_provider_boundaries():
    end = _london_today() - timedelta(days=1)
    start = end - timedelta(days=6)
    result = validate_event_date_range(start.isoformat(), end.isoformat(), "Europe/London")
    assert result["entirely_historical"] is True
    assert result["search_start_datetime"] is None
    assert result["supported_dates"] == []


def test_partially_historical_range_starts_search_today():
    today = _london_today()
    result = validate_event_date_range(
        (today - timedelta(days=2)).isoformat(),
        (today + timedelta(days=2)).isoformat(),
        "Europe/London",
    )
    assert result["contains_past_dates"] is True
    assert result["supported_dates"][0] == today.isoformat()


def test_dst_boundaries_are_converted_to_utc():
    result = validate_event_date_range("2026-10-24", "2026-10-26", "Europe/London")
    assert result["search_start_datetime"] == "2026-10-23T23:00:00Z"
    assert result["search_end_datetime"] == "2026-10-27T00:00:00Z"


class FakeResponse:
    def __init__(self, status_code=200, payload=None, json_error=None):
        self.status_code = status_code
        self.payload = {} if payload is None else payload
        self.json_error = json_error

    def json(self):
        if self.json_error:
            raise self.json_error
        return self.payload


def _provider_inputs(event_environment):
    configuration = load_events_configuration()
    today = _london_today()
    date_range = validate_event_date_range(
        today.isoformat(),
        (today + timedelta(days=6)).isoformat(),
        configuration["timezone"],
    )
    return configuration, date_range


def test_provider_request_uses_geopoint_and_exact_range(event_environment, monkeypatch):
    configuration, date_range = _provider_inputs(event_environment)
    captured = {}

    def fake_get(url, **kwargs):
        captured.update({"url": url, **kwargs})
        return FakeResponse(payload={"_embedded": {"events": []}})

    monkeypatch.setattr("app.services.events_service.requests.get", fake_get)
    result = fetch_ticketmaster_events(configuration, date_range)
    assert result == {"_embedded": {"events": []}}
    assert captured["url"].startswith("https://")
    assert captured["params"]["geoPoint"] == "gcpus7duz"
    assert captured["params"]["radius"] == "10"
    assert "latlong" not in captured["params"]
    assert captured["params"]["startDateTime"] == date_range["search_start_datetime"]
    assert captured["params"]["size"] == 100


def test_provider_retries_a_rejected_geo_query_by_city(
    event_environment, monkeypatch
):
    configuration, date_range = _provider_inputs(event_environment)
    captured = []

    def fake_get(url, **kwargs):
        captured.append(kwargs["params"])
        if len(captured) == 1:
            return FakeResponse(status_code=400)
        return FakeResponse(payload={"_embedded": {"events": []}})

    monkeypatch.setattr("app.services.events_service.requests.get", fake_get)
    result = fetch_ticketmaster_events(configuration, date_range)

    assert len(captured) == 2
    assert captured[0]["geoPoint"] == "gcpus7duz"
    assert "geoPoint" not in captured[1]
    assert captured[1]["city"] == "London"
    assert result["_local_radius_filter_required"] is True


@pytest.mark.parametrize(
    "failure",
    [requests.Timeout("secret URL"), requests.ConnectionError("secret URL")],
)
def test_provider_network_failures_are_sanitised(
    event_environment, monkeypatch, failure
):
    configuration, date_range = _provider_inputs(event_environment)

    def fake_get(*args, **kwargs):
        raise failure

    monkeypatch.setattr("app.services.events_service.requests.get", fake_get)
    with pytest.raises(EventsProviderError) as caught:
        fetch_ticketmaster_events(configuration, date_range)
    assert "private-test-key" not in str(caught.value)
    assert "secret URL" not in str(caught.value)


@pytest.mark.parametrize("status_code", [401, 429, 500, 503, 400])
def test_provider_http_failures_are_controlled(
    event_environment, monkeypatch, status_code
):
    configuration, date_range = _provider_inputs(event_environment)
    monkeypatch.setattr(
        "app.services.events_service.requests.get",
        lambda *args, **kwargs: FakeResponse(status_code=status_code),
    )
    with pytest.raises(EventsProviderError) as caught:
        fetch_ticketmaster_events(configuration, date_range)
    assert "private-test-key" not in str(caught.value)


def test_invalid_provider_json_is_controlled(event_environment, monkeypatch):
    configuration, date_range = _provider_inputs(event_environment)
    monkeypatch.setattr(
        "app.services.events_service.requests.get",
        lambda *args, **kwargs: FakeResponse(json_error=ValueError("bad")),
    )
    with pytest.raises(EventsProviderError):
        fetch_ticketmaster_events(configuration, date_range)


def test_historical_provider_request_makes_no_network_call(
    event_environment, monkeypatch
):
    configuration = load_events_configuration()
    end = _london_today() - timedelta(days=1)
    date_range = validate_event_date_range(
        (end - timedelta(days=2)).isoformat(), end.isoformat(), "Europe/London"
    )
    monkeypatch.setattr(
        "app.services.events_service.requests.get",
        lambda *args, **kwargs: pytest.fail("Ticketmaster must not be called"),
    )
    assert fetch_ticketmaster_events(configuration, date_range) == {}


def _raw_event(event_id="event-1", **overrides):
    event = {
        "id": event_id,
        "name": "Example Concert",
        "url": "https://www.ticketmaster.co.uk/example",
        "distance": 1.8,
        "dates": {
            "start": {"localDate": _london_today().isoformat(), "localTime": "19:30:00"},
            "timezone": "Europe/London",
        },
        "classifications": [
            {"segment": {"name": "Music"}, "genre": {"name": "Rock"}}
        ],
        "_embedded": {
            "venues": [
                {
                    "name": "Example Arena",
                    "city": {"name": "London"},
                    "location": {"latitude": "51.45", "longitude": "-0.15"},
                }
            ]
        },
    }
    event.update(overrides)
    return event


def _normalise(event_environment, events, page=None):
    configuration, date_range = _provider_inputs(event_environment)
    return normalise_ticketmaster_events(
        {"_embedded": {"events": events}, "page": page or {}},
        configuration,
        date_range,
    )


def test_valid_event_is_normalised_without_provider_internals(event_environment):
    result = _normalise(event_environment, [_raw_event()])
    event = result["events"][0]
    assert event["category"] == "Music"
    assert event["genre"] == "Rock"
    assert event["distance_km"] == 1.8
    assert event["impact_level"] == "High"
    assert "classifications" not in event
    assert "images" not in event


def test_city_fallback_excludes_event_without_verifiable_distance(
    event_environment,
):
    configuration, date_range = _provider_inputs(event_environment)
    raw_event = _raw_event()
    raw_event.pop("distance", None)
    raw_event["_embedded"]["venues"][0].pop("location", None)
    result = normalise_ticketmaster_events(
        {
            "_embedded": {"events": [raw_event]},
            "_local_radius_filter_required": True,
        },
        configuration,
        date_range,
    )
    assert result["events"] == []


def test_missing_embedded_events_is_empty(event_environment):
    configuration, date_range = _provider_inputs(event_environment)
    assert normalise_ticketmaster_events({}, configuration, date_range)["events"] == []


def test_duplicate_and_test_events_are_removed(event_environment):
    result = _normalise(
        event_environment,
        [_raw_event(), _raw_event(), _raw_event("test", test=True)],
    )
    assert [event["id"] for event in result["events"]] == ["event-1"]


def test_missing_classification_and_venue_are_safe(event_environment):
    event = _raw_event(classifications=[], _embedded={})
    result = _normalise(event_environment, [event])["events"][0]
    assert result["category"] == "Other"
    assert result["genre"] == "Unspecified"
    assert result["venue"]["name"] == "Venue unavailable"
    assert result["distance_km"] == 1.8


def test_haversine_is_used_when_provider_distance_is_missing(event_environment):
    event = _raw_event()
    event.pop("distance")
    result = _normalise(event_environment, [event])["events"][0]
    assert result["distance_km"] is not None


def test_unsafe_url_is_removed(event_environment):
    result = _normalise(
        event_environment, [_raw_event(url="javascript:alert(1)")]
    )["events"][0]
    assert result["url"] is None


def test_outside_radius_and_missing_date_are_excluded(event_environment):
    missing_date = _raw_event("missing")
    missing_date["dates"]["start"].pop("localDate")
    result = _normalise(
        event_environment,
        [_raw_event(distance=10.1), missing_date],
    )
    assert result["events"] == []


def test_page_metadata_marks_truncated_results(event_environment):
    result = _normalise(
        event_environment,
        [_raw_event()],
        page={"totalPages": 2, "totalElements": 101},
    )
    assert result["results_truncated"] is True


def test_daily_context_contains_every_requested_date(event_environment):
    configuration, date_range = _provider_inputs(event_environment)
    normalised = normalise_ticketmaster_events(
        {"_embedded": {"events": [_raw_event()]}}, configuration, date_range
    )
    context = build_daily_event_context(normalised, date_range)
    assert len(context["days"]) == 7
    assert context["days"][0]["event_count"] == 1
    assert context["days"][1]["impact_level"] == "None"
    assert context["summary"]["total_events"] == 1


def test_historical_days_are_not_reported_as_no_events():
    today = _london_today()
    date_range = validate_event_date_range(
        (today - timedelta(days=2)).isoformat(),
        (today + timedelta(days=2)).isoformat(),
        "Europe/London",
    )
    context = build_daily_event_context([], date_range)
    assert context["days"][0] == {
        "date": (today - timedelta(days=2)).isoformat(),
        "supported": False,
        "event_count": 0,
        "impact_score": 0,
        "impact_level": "Unavailable",
        "insight": None,
        "message": "Historical local-event data is unavailable.",
        "events": [],
    }
    assert context["days"][2]["impact_level"] == "None"


def test_busiest_tie_selects_earliest_date():
    today = _london_today()
    date_range = validate_event_date_range(
        today.isoformat(),
        (today + timedelta(days=1)).isoformat(),
        "Europe/London",
    )
    events = [
        {"local_date": today.isoformat(), "impact_score": 2},
        {"local_date": (today + timedelta(days=1)).isoformat(), "impact_score": 2},
    ]
    context = build_daily_event_context(
        {"events": events, "results_truncated": True}, date_range
    )
    assert context["summary"]["busiest_date"] == today.isoformat()
    assert context["summary"]["busiest_event_count"] == 1
    assert context["summary"]["results_truncated"] is True


def test_cache_hit_avoids_second_provider_request(event_environment, monkeypatch):
    calls = []

    def fake_fetch(*args):
        calls.append(True)
        return {"_embedded": {"events": []}}

    monkeypatch.setattr("app.services.events_service.fetch_ticketmaster_events", fake_fetch)
    first = get_local_events()
    second = get_local_events()
    assert len(calls) == 1
    assert first == second
    assert first["summary"]["total_events"] == 0


def test_different_ranges_and_radius_use_separate_cache_entries(
    event_environment, monkeypatch
):
    calls = []
    monkeypatch.setattr(
        "app.services.events_service.fetch_ticketmaster_events",
        lambda *args: calls.append(True) or {},
    )
    today = _london_today()
    get_local_events(today.isoformat(), (today + timedelta(days=1)).isoformat())
    get_local_events(today.isoformat(), (today + timedelta(days=2)).isoformat())
    event_environment.setenv("EVENT_SEARCH_RADIUS_KM", "20")
    get_local_events(today.isoformat(), (today + timedelta(days=2)).isoformat())
    assert len(calls) == 3


def test_expired_cache_is_refetched(event_environment, monkeypatch):
    clock = iter([100.0, 22000.0])
    calls = []
    monkeypatch.setattr("app.services.events_service.time.monotonic", lambda: next(clock))
    monkeypatch.setattr(
        "app.services.events_service.fetch_ticketmaster_events",
        lambda *args: calls.append(True) or {},
    )
    get_local_events()
    get_local_events()
    assert len(calls) == 2


def test_provider_failure_returns_stale_matching_cache(event_environment, monkeypatch):
    monkeypatch.setattr(
        "app.services.events_service.fetch_ticketmaster_events", lambda *args: {}
    )
    fresh = get_local_events()
    for entry in _events_cache.values():
        entry["expires_at"] = 0

    def fail(*args):
        raise EventsProviderError("safe")

    monkeypatch.setattr("app.services.events_service.fetch_ticketmaster_events", fail)
    stale = get_local_events()
    assert fresh["stale"] is False
    assert stale["stale"] is True
    assert stale["warning"] == "Local-event information may be out of date."


def test_provider_failure_without_cache_is_raised(event_environment, monkeypatch):
    monkeypatch.setattr(
        "app.services.events_service.fetch_ticketmaster_events",
        lambda *args: (_ for _ in ()).throw(EventsProviderError("safe")),
    )
    with pytest.raises(EventsProviderError):
        get_local_events()


def test_cache_is_bounded_to_twenty_entries(event_environment, monkeypatch):
    monkeypatch.setattr(
        "app.services.events_service.fetch_ticketmaster_events", lambda *args: {}
    )
    today = _london_today()
    for offset in range(21):
        start = today + timedelta(days=offset)
        get_local_events(start.isoformat(), start.isoformat())
    assert len(_events_cache) == 20


def test_entirely_historical_context_does_not_use_cache_or_provider(
    event_environment, monkeypatch
):
    monkeypatch.setattr(
        "app.services.events_service.fetch_ticketmaster_events",
        lambda *args: pytest.fail("Provider must not be called"),
    )
    end = _london_today() - timedelta(days=1)
    result = get_local_events(
        (end - timedelta(days=2)).isoformat(), end.isoformat()
    )
    assert result["range"]["contains_past_dates"] is True
    assert len(_events_cache) == 0
