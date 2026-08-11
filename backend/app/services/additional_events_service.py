"""Optional Bandsintown and TheSportsDB event providers."""

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from urllib.parse import quote

import requests

from app.utils.event_impact import calculate_event_impact
from app.utils.geo_utils import calculate_distance_km


BANDSINTOWN_URL = "https://rest.bandsintown.com/artists/{artist}/events"
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


def fetch_bandsintown_events(configuration, validated_range):
    """Fetch configured artists. Bandsintown has no location-wide discovery API."""

    app_id = configuration.get("bandsintown_app_id")
    artists = configuration.get("bandsintown_artists", [])
    if not app_id or not artists:
        return [], None

    requested_dates = set(validated_range["supported_dates"])
    events = []
    failed = False
    for artist in artists:
        try:
            response = requests.get(
                BANDSINTOWN_URL.format(artist=quote(artist, safe="")),
                params={
                    "app_id": app_id,
                    "date": (
                        f'{validated_range["supported_dates"][0]},'
                        f'{validated_range["supported_dates"][-1]}'
                    ),
                },
                timeout=PROVIDER_TIMEOUT,
            )
            if response.status_code != 200:
                failed = True
                continue
            payload = response.json()
        except (requests.RequestException, ValueError):
            failed = True
            continue
        if not isinstance(payload, list):
            failed = True
            continue
        for item in payload:
            if not isinstance(item, dict):
                continue
            try:
                starts_at = datetime.fromisoformat(str(item.get("datetime", "")).replace("Z", "+00:00"))
            except ValueError:
                continue
            local_date = starts_at.date().isoformat()
            if local_date not in requested_dates:
                continue
            venue = item.get("venue") if isinstance(item.get("venue"), dict) else {}
            distance = _distance(configuration, venue.get("latitude"), venue.get("longitude"))
            if distance is None or distance > configuration["radius_km"]:
                continue
            lineup = item.get("lineup") if isinstance(item.get("lineup"), list) else []
            events.append(_provider_event(
                event_id=str(item.get("id") or f"{artist}-{starts_at.isoformat()}"),
                name=" & ".join(str(value) for value in lineup if value) or artist,
                category="Music", genre="Concert", local_date=local_date,
                local_time=starts_at.time().replace(microsecond=0).isoformat(),
                venue_name=venue.get("name"), venue_city=venue.get("city"),
                distance_km=distance, url=item.get("url"), provider="Bandsintown",
                event_type="concerts", timezone=configuration["timezone"],
            ))
    warning = "Some Bandsintown artist results are unavailable." if failed else None
    return events, warning


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
