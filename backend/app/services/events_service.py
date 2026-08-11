"""Ticketmaster configuration, retrieval, normalisation, and caching."""

import os
import time
from copy import deepcopy
from datetime import date, datetime, time as datetime_time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from urllib.parse import urlparse
from threading import RLock

import requests

from app.utils.event_impact import (
    build_daily_event_insight,
    calculate_daily_impact,
    calculate_event_impact,
)
from app.utils.geo_utils import calculate_distance_km
from app.utils.geo_utils import create_geopoint
from app.services.additional_events_service import (
    fetch_bandsintown_events,
    fetch_sportsdb_events,
)


DEFAULT_EVENTS_CACHE_TTL_SECONDS = 21600
DEFAULT_EVENTS_MAX_RESULTS = 100
DEFAULT_TICKETMASTER_LOCALE = "en-gb"
TICKETMASTER_EVENTS_URL = (
    "https://app.ticketmaster.com/discovery/v2/events.json"
)
TICKETMASTER_TIMEOUT = (3, 8)
EVENTS_CACHE_MAX_ENTRIES = 20
_events_cache = {}
_events_cache_lock = RLock()


class EventsConfigurationError(Exception):
    """Raised for invalid server-side Ticketmaster configuration."""


class EventsProviderError(Exception):
    """Raised when Ticketmaster cannot provide a usable response."""

    def __init__(self, message, *, reason="provider_request_failed"):
        super().__init__(message)
        self.reason = reason


class EventsRequestError(Exception):
    """Raised for an unsupported client date range."""


def _required_environment(name):
    value = os.getenv(name, "").strip()
    if not value:
        raise EventsConfigurationError("Local-event configuration is incomplete.")
    return value


def _configuration_number(name, *, minimum, maximum=None, integer=False, default=None):
    raw_value = os.getenv(name, str(default) if default is not None else "").strip()
    try:
        value = int(raw_value) if integer else float(raw_value)
    except (TypeError, ValueError) as error:
        raise EventsConfigurationError("Local-event configuration is invalid.") from error
    if value < minimum or (maximum is not None and value > maximum):
        raise EventsConfigurationError("Local-event configuration is invalid.")
    return value


def load_events_configuration():
    """Read and validate event settings each time a request is handled."""

    api_key = _required_environment("TICKETMASTER_API_KEY")
    city = _required_environment("RESTAURANT_CITY")
    country_code = _required_environment("RESTAURANT_COUNTRY_CODE").upper()
    timezone = _required_environment("RESTAURANT_TIMEZONE")

    if len(country_code) != 2 or not country_code.isalpha():
        raise EventsConfigurationError("Local-event configuration is invalid.")

    latitude = _configuration_number("RESTAURANT_LATITUDE", minimum=-90, maximum=90)
    longitude = _configuration_number("RESTAURANT_LONGITUDE", minimum=-180, maximum=180)
    radius_km = _configuration_number(
        "EVENT_SEARCH_RADIUS_KM", minimum=0.000001, maximum=100, default=10
    )
    cache_ttl_seconds = _configuration_number(
        "EVENTS_CACHE_TTL_SECONDS",
        minimum=1,
        integer=True,
        default=DEFAULT_EVENTS_CACHE_TTL_SECONDS,
    )
    max_results = _configuration_number(
        "EVENTS_MAX_RESULTS",
        minimum=1,
        maximum=100,
        integer=True,
        default=DEFAULT_EVENTS_MAX_RESULTS,
    )
    locale = os.getenv("TICKETMASTER_LOCALE", DEFAULT_TICKETMASTER_LOCALE).strip()
    locale = locale or DEFAULT_TICKETMASTER_LOCALE
    bandsintown_artists = [
        artist.strip()
        for artist in os.getenv("BANDSINTOWN_ARTISTS", "").split(",")
        if artist.strip()
    ][:10]

    try:
        geo_point = create_geopoint(latitude, longitude)
    except ValueError as error:
        raise EventsConfigurationError("Local-event configuration is invalid.") from error

    return {
        "api_key": api_key,
        "city": city,
        "country_code": country_code,
        "latitude": latitude,
        "longitude": longitude,
        "timezone": timezone,
        "radius_km": radius_km,
        "cache_ttl_seconds": cache_ttl_seconds,
        "max_results": max_results,
        "locale": locale,
        "geo_point": geo_point,
        "bandsintown_app_id": os.getenv("BANDSINTOWN_APP_ID", "").strip(),
        "bandsintown_artists": bandsintown_artists,
        "sportsdb_enabled": os.getenv("SPORTSDB_ENABLED", "true").strip().casefold()
        in {"1", "true", "yes", "on"},
        "sportsdb_api_key": os.getenv("SPORTSDB_API_KEY", "123").strip() or "123",
    }


def _parse_request_date(value):
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError) as error:
        raise EventsRequestError("A valid event date range is required.") from error


def _utc_boundary(local_date, restaurant_zone):
    local_datetime = datetime.combine(
        local_date,
        datetime_time.min,
        tzinfo=restaurant_zone,
    )
    return local_datetime.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _last_day_of_month(value):
    if value.month == 12:
        next_month = date(value.year + 1, 1, 1)
    else:
        next_month = date(value.year, value.month + 1, 1)
    return next_month - timedelta(days=1)


def validate_event_date_range(
    start_date_value,
    end_date_value,
    restaurant_timezone,
):
    """Validate a maximum 31-day local range and derive UTC search bounds."""

    try:
        restaurant_zone = ZoneInfo(restaurant_timezone)
    except (TypeError, ZoneInfoNotFoundError) as error:
        raise EventsRequestError("A valid event date range is required.") from error

    today = datetime.now(restaurant_zone).date()
    if start_date_value is None and end_date_value is None:
        start_date = today.replace(day=1)
        end_date = _last_day_of_month(today)
    elif start_date_value is None or end_date_value is None:
        raise EventsRequestError("A valid event date range is required.")
    else:
        start_date = _parse_request_date(start_date_value)
        end_date = _parse_request_date(end_date_value)

    if start_date > end_date or (end_date - start_date).days + 1 > 31:
        raise EventsRequestError("A valid event date range is required.")

    requested_dates = [
        start_date + timedelta(days=offset)
        for offset in range((end_date - start_date).days + 1)
    ]
    supported_dates = [value for value in requested_dates if value >= today]
    effective_start = max(start_date, today) if supported_dates else None

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "requested_dates": [value.isoformat() for value in requested_dates],
        "supported_dates": [value.isoformat() for value in supported_dates],
        "contains_past_dates": any(value < today for value in requested_dates),
        "entirely_historical": not supported_dates,
        "search_start_datetime": (
            _utc_boundary(effective_start, restaurant_zone)
            if effective_start
            else None
        ),
        "search_end_datetime": (
            _utc_boundary(end_date + timedelta(days=1), restaurant_zone)
            if supported_dates
            else None
        ),
    }


def fetch_ticketmaster_events(configuration, validated_range):
    """Fetch page zero from Ticketmaster using safe, server-only parameters."""

    if validated_range["entirely_historical"]:
        return {}

    radius = configuration["radius_km"]
    parameters = {
        "apikey": configuration["api_key"],
        "geoPoint": configuration["geo_point"],
        "radius": f"{radius:g}",
        "unit": "km",
        "countryCode": configuration["country_code"],
        "startDateTime": validated_range["search_start_datetime"],
        "endDateTime": validated_range["search_end_datetime"],
        "includeTBA": "no",
        "includeTBD": "no",
        "includeTest": "no",
        "size": configuration["max_results"],
        "page": 0,
        "sort": "date,asc",
        "locale": configuration["locale"],
    }

    def send_request(request_parameters):
        try:
            return requests.get(
                TICKETMASTER_EVENTS_URL,
                params=request_parameters,
                timeout=TICKETMASTER_TIMEOUT,
            )
        except (requests.Timeout, requests.ConnectionError):
            raise EventsProviderError(
                "The local-event provider is temporarily unavailable.",
                reason="provider_timeout",
            ) from None
        except requests.RequestException:
            raise EventsProviderError(
                "The local-event provider request failed.",
                reason="provider_request_failed",
            ) from None

    response = send_request(parameters)
    radius_filter_required = False

    # Some Ticketmaster gateways reject combined geo filters with HTTP 400.
    # Retry using the restaurant city, then enforce the radius from venue
    # coordinates during normalisation.
    if response.status_code == 400:
        fallback_parameters = {
            "apikey": configuration["api_key"],
            "city": configuration["city"],
            "countryCode": configuration["country_code"],
            "startDateTime": validated_range["search_start_datetime"],
            "endDateTime": validated_range["search_end_datetime"],
            "size": configuration["max_results"],
            "page": 0,
            "sort": "date,asc",
            "locale": configuration["locale"],
        }
        response = send_request(fallback_parameters)
        radius_filter_required = True

    if response.status_code == 401:
        raise EventsProviderError(
            "The local-event provider credentials are invalid.",
            reason="credentials_invalid",
        )
    if response.status_code == 403:
        raise EventsProviderError(
            "The local-event provider denied access.",
            reason="access_denied",
        )
    if response.status_code == 429:
        raise EventsProviderError(
            "The local-event provider quota is unavailable.",
            reason="quota_unavailable",
        )
    if response.status_code >= 500:
        raise EventsProviderError(
            "The local-event provider is temporarily unavailable.",
            reason="provider_unavailable",
        )
    if not 200 <= response.status_code < 300:
        raise EventsProviderError(
            "The local-event provider request failed.",
            reason="invalid_request",
        )

    try:
        raw_data = response.json()
    except ValueError:
        raise EventsProviderError(
            "The local-event provider returned an invalid response.",
            reason="invalid_response",
        ) from None
    if not isinstance(raw_data, dict):
        raise EventsProviderError(
            "The local-event provider returned an invalid response.",
            reason="invalid_response",
        )
    if radius_filter_required:
        raw_data["_local_radius_filter_required"] = True
    return raw_data


def _nested_name(value, default):
    if isinstance(value, dict):
        name = value.get("name")
        if isinstance(name, str) and name.strip():
            return name.strip()
    return default


def _nonnegative_number(value):
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number >= 0 else None


def _safe_https_url(value):
    if not isinstance(value, str):
        return None
    parsed = urlparse(value.strip())
    if parsed.scheme != "https" or not parsed.netloc:
        return None
    return value.strip()


def normalise_ticketmaster_events(raw_data, configuration, validated_range):
    """Return a stable, minimal event list from Ticketmaster's nested data."""

    radius_filter_required = bool(
        isinstance(raw_data, dict)
        and raw_data.get("_local_radius_filter_required") is True
    )
    embedded = raw_data.get("_embedded") if isinstance(raw_data, dict) else None
    raw_events = embedded.get("events", []) if isinstance(embedded, dict) else []
    if not isinstance(raw_events, list):
        raw_events = []

    requested_dates = set(validated_range["requested_dates"])
    normalised_events = []
    seen_ids = set()

    for raw_event in raw_events:
        if not isinstance(raw_event, dict) or raw_event.get("test") is True:
            continue
        event_id = raw_event.get("id")
        if not isinstance(event_id, str) or not event_id.strip() or event_id in seen_ids:
            continue

        dates = raw_event.get("dates") or {}
        start = dates.get("start") if isinstance(dates, dict) else {}
        start = start if isinstance(start, dict) else {}
        local_date = start.get("localDate")
        try:
            parsed_date = date.fromisoformat(local_date)
        except (TypeError, ValueError):
            continue
        if parsed_date.isoformat() not in requested_dates:
            continue

        local_time = start.get("localTime")
        if not isinstance(local_time, str) or not local_time.strip():
            local_time = None

        classifications = raw_event.get("classifications")
        classification = (
            classifications[0]
            if isinstance(classifications, list)
            and classifications
            and isinstance(classifications[0], dict)
            else {}
        )
        category = _nested_name(classification.get("segment"), "Other")
        genre = _nested_name(classification.get("genre"), "Unspecified")
        event_type = (
            "concerts" if category.casefold() == "music"
            else "sports" if category.casefold() == "sports"
            else "general"
        )

        event_embedded = raw_event.get("_embedded") or {}
        venues = event_embedded.get("venues", []) if isinstance(event_embedded, dict) else []
        venue = venues[0] if isinstance(venues, list) and venues and isinstance(venues[0], dict) else {}
        venue_location = venue.get("location") or {}
        venue_latitude = venue_location.get("latitude") if isinstance(venue_location, dict) else None
        venue_longitude = venue_location.get("longitude") if isinstance(venue_location, dict) else None

        distance_km = _nonnegative_number(raw_event.get("distance"))
        if distance_km is None:
            distance_km = calculate_distance_km(
                configuration["latitude"],
                configuration["longitude"],
                venue_latitude,
                venue_longitude,
            )
        if distance_km is not None:
            distance_km = round(distance_km, 1)
            if distance_km > configuration["radius_km"]:
                continue
        elif radius_filter_required:
            continue

        impact = calculate_event_impact(distance_km, category, local_time)
        city = venue.get("city") if isinstance(venue, dict) else None
        normalised_events.append(
            {
                "id": event_id.strip(),
                "name": str(raw_event.get("name") or "Unnamed event").strip(),
                "category": category,
                "genre": genre,
                "local_date": parsed_date.isoformat(),
                "local_time": local_time,
                "timezone": dates.get("timezone") or configuration["timezone"],
                "venue": {
                    "name": str(venue.get("name") or "Venue unavailable").strip(),
                    "city": _nested_name(city, configuration["city"]),
                },
                "distance_km": distance_km,
                "url": _safe_https_url(raw_event.get("url")),
                "impact_score": impact["score"],
                "impact_level": impact["level"],
                "provider": "Ticketmaster",
                "event_type": event_type,
            }
        )
        seen_ids.add(event_id)

    normalised_events.sort(
        key=lambda event: (
            event["local_date"],
            event["local_time"] or "99:99:99",
            event["name"].casefold(),
        )
    )
    page = raw_data.get("page", {}) if isinstance(raw_data, dict) else {}
    results_truncated = bool(
        isinstance(page, dict)
        and (
            _nonnegative_number(page.get("totalPages")) not in (None, 0, 1)
            or (_nonnegative_number(page.get("totalElements")) or 0)
            > configuration["max_results"]
        )
    )
    return {
        "events": normalised_events,
        "results_truncated": results_truncated,
    }


def build_daily_event_context(events, validated_range):
    """Build exact per-date contexts and summary values for the forecast."""

    if isinstance(events, dict):
        event_list = events.get("events", [])
        results_truncated = bool(events.get("results_truncated"))
    else:
        event_list = events or []
        results_truncated = False

    events_by_date = {}
    for event in event_list:
        if isinstance(event, dict):
            events_by_date.setdefault(event.get("local_date"), []).append(event)

    supported_dates = set(validated_range["supported_dates"])
    days = []
    for date_value in validated_range["requested_dates"]:
        if date_value not in supported_dates:
            days.append(
                {
                    "date": date_value,
                    "supported": False,
                    "event_count": 0,
                    "impact_score": 0,
                    "impact_level": "Unavailable",
                    "insight": None,
                    "message": "Historical local-event data is unavailable.",
                    "events": [],
                }
            )
            continue

        daily_events = events_by_date.get(date_value, [])
        daily_impact = calculate_daily_impact(daily_events)
        days.append(
            {
                "date": date_value,
                "supported": True,
                "event_count": len(daily_events),
                "impact_score": daily_impact["score"],
                "impact_level": daily_impact["level"],
                "insight": build_daily_event_insight(
                    len(daily_events), daily_impact["level"]
                ),
                "message": None,
                "events": daily_events,
            }
        )

    populated_days = [day for day in days if day["supported"] and day["event_count"]]
    busiest = (
        sorted(populated_days, key=lambda day: (-day["event_count"], day["date"]))[0]
        if populated_days
        else None
    )
    return {
        "days": days,
        "summary": {
            "total_events": sum(day["event_count"] for day in days if day["supported"]),
            "days_with_events": len(populated_days),
            "high_impact_days": sum(
                1
                for day in days
                if day["supported"] and day["impact_level"] == "High"
            ),
            "busiest_date": busiest["date"] if busiest else None,
            "busiest_event_count": busiest["event_count"] if busiest else 0,
            "results_truncated": results_truncated,
        },
    }


def _events_cache_key(configuration, validated_range):
    return (
        configuration["city"].casefold(),
        configuration["country_code"],
        configuration["geo_point"],
        configuration["radius_km"],
        validated_range["start_date"],
        validated_range["end_date"],
        configuration["max_results"],
        configuration["bandsintown_app_id"],
        tuple(configuration["bandsintown_artists"]),
        configuration["sportsdb_enabled"],
        configuration["sportsdb_api_key"],
    )


def _clear_events_cache():
    """Reset the best-effort in-memory cache (primarily for tests)."""

    with _events_cache_lock:
        _events_cache.clear()


def _final_event_context(configuration, validated_range, normalised):
    daily_context = build_daily_event_context(normalised, validated_range)
    return {
        "location": {
            "city": configuration["city"],
            "country_code": configuration["country_code"],
            "radius_km": configuration["radius_km"],
        },
        "range": {
            "start_date": validated_range["start_date"],
            "end_date": validated_range["end_date"],
            "contains_past_dates": validated_range["contains_past_dates"],
        },
        "summary": daily_context["summary"],
        "days": daily_context["days"],
        "fetched_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "stale": False,
        "warning": None,
        "provider_warnings": [],
    }


def get_local_events(start_date=None, end_date=None):
    """Return cached or freshly normalised local-event context."""

    configuration = load_events_configuration()
    validated_range = validate_event_date_range(
        start_date,
        end_date,
        configuration["timezone"],
    )

    if validated_range["entirely_historical"]:
        return _final_event_context(configuration, validated_range, [])

    cache_key = _events_cache_key(configuration, validated_range)
    now = time.monotonic()
    with _events_cache_lock:
        cached_entry = _events_cache.get(cache_key)
        if cached_entry and now < cached_entry["expires_at"]:
            return deepcopy(cached_entry["data"])

    try:
        raw_data = fetch_ticketmaster_events(configuration, validated_range)
        normalised = normalise_ticketmaster_events(
            raw_data,
            configuration,
            validated_range,
        )
        combined_events = list(normalised["events"])
        provider_warnings = []
        for provider_fetch in (fetch_bandsintown_events, fetch_sportsdb_events):
            extra_events, warning = provider_fetch(configuration, validated_range)
            combined_events.extend(extra_events)
            if warning:
                provider_warnings.append(warning)

        deduplicated = {}
        for event in combined_events:
            key = (
                event.get("name", "").casefold(), event.get("local_date"),
                event.get("venue", {}).get("name", "").casefold(),
            )
            deduplicated.setdefault(key, event)
        combined_events = sorted(
            deduplicated.values(),
            key=lambda event: (event["local_date"], event.get("local_time") or "99:99:99", event["name"].casefold()),
        )
        data = _final_event_context(
            configuration,
            validated_range,
            {"events": combined_events, "results_truncated": normalised["results_truncated"]},
        )
        data["provider_warnings"] = provider_warnings
    except EventsProviderError:
        with _events_cache_lock:
            cached_entry = _events_cache.get(cache_key)
            if cached_entry:
                stale_data = deepcopy(cached_entry["data"])
                stale_data["stale"] = True
                stale_data["warning"] = "Local-event information may be out of date."
                return stale_data
        raise

    with _events_cache_lock:
        _events_cache[cache_key] = {
            "data": deepcopy(data),
            "expires_at": now + configuration["cache_ttl_seconds"],
        }
        while len(_events_cache) > EVENTS_CACHE_MAX_ENTRIES:
            oldest_key = min(
                _events_cache,
                key=lambda key: _events_cache[key]["expires_at"],
            )
            del _events_cache[oldest_key]
    return deepcopy(data)
