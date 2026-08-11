"""Optional Skiddle and TheSportsDB event providers."""

from concurrent.futures import ThreadPoolExecutor, as_completed
from math import ceil

import requests

from app.utils.event_impact import calculate_event_impact
from app.utils.geo_utils import calculate_distance_km


SKIDDLE_URL = "https://www.skiddle.com/api/v1/events/search/"
SPORTSDB_URL = "https://www.thesportsdb.com/api/v1/json/{key}/eventsday.php"
PROVIDER_TIMEOUT = (3, 7)
# The free schedule feed exposes venue names but not venue coordinates. This
# small London lookup lets the shared radius rule remain exact; unknown venues
# are excluded rather than pretending they are local.
LONDON_VENUE_COORDINATES = {
    "stamford bridge": (51.4817, -0.1910),
    "craven cottage": (51.4750, -0.2217),
    "selhurst park": (51.3983, -0.0855),
    "the oval": (51.4837, -0.1149),
    "kia oval": (51.4837, -0.1149),
    "lord's cricket ground": (51.5299, -0.1722),
    "lords cricket ground": (51.5299, -0.1722),
    "twickenham stadium": (51.4561, -0.3415),
    "the den": (51.4864, -0.0508),
    "wembley stadium": (51.5560, -0.2795),
    "emirates stadium": (51.5549, -0.1084),
    "london stadium": (51.5387, -0.0166),
    "tottenham hotspur stadium": (51.6043, -0.0664),
}


def _number(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _distance(configuration, latitude, longitude):
    value = calculate_distance_km(
        configuration["latitude"], configuration["longitude"], latitude, longitude
    )
    return round(value, 1) if value is not None else None


def _provider_event(
    *, event_id, name, category, genre, local_date, local_time, venue_name,
    venue_city, distance_km, url, provider, event_type, timezone
):
    impact = calculate_event_impact(distance_km, category, local_time)
    return {
        "id": f"{provider.casefold()}:{event_id}",
        "name": name or "Unnamed event",
        "category": category,
        "genre": genre or "Unspecified",
        "local_date": local_date,
        "local_time": local_time,
        "timezone": timezone,
        "venue": {
            "name": venue_name or "Venue unavailable",
            "city": venue_city or "City unavailable",
        },
        "distance_km": distance_km,
        "url": url if isinstance(url, str) and url.startswith("https://") else None,
        "impact_score": impact["score"],
        "impact_level": impact["level"],
        "provider": provider,
        "event_type": event_type,
    }


def fetch_skiddle_events(configuration, validated_range):
    """Fetch all nearby Skiddle events for the exact requested date range."""

    api_key = configuration.get("skiddle_api_key")
    if not api_key or not validated_range["supported_dates"]:
        return [], None
    try:
        response = requests.get(
            SKIDDLE_URL,
            params={
                "api_key": api_key,
                "latitude": configuration["latitude"],
                "longitude": configuration["longitude"],
                # Skiddle accepts an integer radius in miles. Query outwards,
                # then apply the exact kilometre boundary below.
                "radius": ceil(configuration["radius_km"] / 1.609344),
                "getdistance": 1,
                "minDate": validated_range["supported_dates"][0],
                "maxDate": validated_range["supported_dates"][-1],
                "description": 1,
                "order": "distance",
                "limit": min(configuration["max_results"], 100),
                "offset": 0,
            },
            timeout=PROVIDER_TIMEOUT,
        )
        if response.status_code != 200:
            return [], "Skiddle event results are unavailable."
        payload = response.json()
    except (requests.RequestException, ValueError):
        return [], "Skiddle event results are unavailable."

    raw_events = payload.get("results", []) if isinstance(payload, dict) else []
    if not isinstance(raw_events, list):
        return [], "Skiddle event results are unavailable."
    requested_dates = set(validated_range["supported_dates"])
    events = []
    for item in raw_events:
        if not isinstance(item, dict):
            continue
        event_id = str(item.get("id") or item.get("eventid") or "").strip()
        local_date = str(item.get("date") or item.get("startdate") or "")[:10]
        if not event_id or local_date not in requested_dates:
            continue
        venue = item.get("venue") if isinstance(item.get("venue"), dict) else {}
        distance = _distance(
            configuration,
            venue.get("latitude") or item.get("latitude"),
            venue.get("longitude") or item.get("longitude"),
        )
        if distance is None:
            provider_distance = _number(item.get("distance"))
            distance = round(provider_distance * 1.609344, 1) if provider_distance is not None else None
        if distance is None or distance > configuration["radius_km"]:
            continue
        event_code = str(item.get("EventCode") or item.get("eventcode") or "").upper()
        event_type = (
            "concerts" if event_code in {"LIVE", "CLUB", "FEST"}
            else "sports" if event_code == "SPORT"
            else "general"
        )
        category = (
            "Music" if event_type == "concerts"
            else "Sports" if event_type == "sports"
            else "General"
        )
        genres = item.get("genres") if isinstance(item.get("genres"), list) else []
        genre_names = [
            str(value.get("name") if isinstance(value, dict) else value).strip()
            for value in genres
            if value
        ]
        raw_time = str(item.get("openingtimes", {}).get("doorsopen", "")) if isinstance(item.get("openingtimes"), dict) else ""
        raw_time = raw_time or str(item.get("starttime") or item.get("time") or "")
        events.append(_provider_event(
            event_id=event_id,
            name=str(item.get("eventname") or item.get("name") or "Skiddle event").strip(),
            category=category, genre=", ".join(genre_names) or event_code or "Event",
            local_date=local_date, local_time=raw_time[:8] or None,
            venue_name=venue.get("name"),
            venue_city=venue.get("town") or venue.get("city") or configuration["city"],
            distance_km=distance, url=item.get("link") or item.get("url"),
            provider="Skiddle", event_type=event_type,
            timezone=configuration["timezone"],
        ))
    return events, None


def _fetch_sports_day(configuration, day):
    response = requests.get(
        SPORTSDB_URL.format(key=configuration["sportsdb_api_key"]),
        params={"d": day}, timeout=PROVIDER_TIMEOUT,
    )
    if response.status_code != 200:
        return [], True
    payload = response.json()
    raw_events = payload.get("events", []) if isinstance(payload, dict) else []
    return (raw_events if isinstance(raw_events, list) else []), False


def fetch_sportsdb_events(configuration, validated_range):
    """Fetch daily sports schedules concurrently and retain verifiably local events."""

    if not configuration.get("sportsdb_enabled"):
        return [], None
    dates = validated_range["supported_dates"]
    if not dates:
        return [], None

    raw_events = []
    failed = False
    with ThreadPoolExecutor(max_workers=min(8, len(dates))) as executor:
        futures = {executor.submit(_fetch_sports_day, configuration, day): day for day in dates}
        for future in as_completed(futures):
            try:
                items, day_failed = future.result()
                raw_events.extend(items)
                failed = failed or day_failed
            except (requests.RequestException, ValueError):
                failed = True

    events = []
    seen = set()
    for item in raw_events:
        if not isinstance(item, dict):
            continue
        event_id = str(item.get("idEvent") or "").strip()
        local_date = str(item.get("dateEvent") or "")
        if not event_id or event_id in seen or local_date not in dates:
            continue
        venue_name = str(item.get("strVenue") or "").strip()
        known_coordinates = LONDON_VENUE_COORDINATES.get(venue_name.casefold())
        latitude = item.get("strVenueLatitude") or item.get("strLatitude")
        longitude = item.get("strVenueLongitude") or item.get("strLongitude")
        if known_coordinates and (_number(latitude) is None or _number(longitude) is None):
            latitude, longitude = known_coordinates
        distance = _distance(configuration, latitude, longitude)
        city = str(item.get("strCity") or item.get("strVenueCity") or "").strip()
        if distance is not None and distance > configuration["radius_km"]:
            continue
        if distance is None:
            continue
        raw_time = str(item.get("strTime") or "").strip()
        local_time = raw_time[:8] if raw_time else None
        events.append(_provider_event(
            event_id=event_id, name=str(item.get("strEvent") or "Sports event").strip(),
            category="Sports", genre=str(item.get("strSport") or item.get("strLeague") or "Sport").strip(),
            local_date=local_date, local_time=local_time,
            venue_name=venue_name, venue_city=city or configuration["city"],
            distance_km=distance, url=item.get("strEventOfficial") or item.get("strWebsite"),
            provider="TheSportsDB", event_type="sports", timezone=configuration["timezone"],
        ))
        seen.add(event_id)
    warning = "Some TheSportsDB schedule results are unavailable." if failed else None
    return events, warning
