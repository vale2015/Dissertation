"""Transparent heuristic scoring for potential local-event impact."""

from datetime import time


CATEGORY_SCORES = {
    "music": 2,
    "sports": 2,
    "arts & theatre": 1,
    "family": 1,
    "film": 1,
}

DAILY_INSIGHTS = {
    "None": "No Ticketmaster events were found near the restaurant.",
    "Low": "Limited local event activity is currently identified.",
    "Medium": (
        "Nearby events may affect local footfall. Review reservations for this date."
    ),
    "High": (
        "High local event activity may increase nearby footfall. "
        "Review capacity and staffing."
    ),
}


def _event_level(score):
    if score <= 2:
        return "Low"
    if score <= 4:
        return "Medium"
    return "High"


def _valid_time(local_time):
    if not isinstance(local_time, str):
        return None
    try:
        hours, minutes, *seconds = local_time.split(":")
        return time(int(hours), int(minutes), int(seconds[0]) if seconds else 0)
    except (TypeError, ValueError):
        return None


def calculate_event_impact(distance_km, category, local_time):
    """Return a repeatable score and label without estimating attendance."""

    distance_score = 0
    if isinstance(distance_km, (int, float)) and not isinstance(distance_km, bool):
        if 0 <= distance_km <= 2:
            distance_score = 3
        elif distance_km <= 5:
            distance_score = 2
        elif distance_km > 5:
            distance_score = 1

    category_score = CATEGORY_SCORES.get(str(category).strip().lower(), 0)
    parsed_time = _valid_time(local_time)
    time_score = int(bool(parsed_time and time(16, 0) <= parsed_time <= time(22, 0)))
    score = distance_score + category_score + time_score
    return {"score": score, "level": _event_level(score)}


def calculate_daily_impact(events):
    """Aggregate event scores for one day, capped at ten points."""

    score = min(
        10,
        sum(
            max(0, int(event.get("impact_score", 0)))
            for event in (events or [])
            if isinstance(event, dict)
        ),
    )
    if score == 0:
        level = "None"
    elif score <= 2:
        level = "Low"
    elif score <= 4:
        level = "Medium"
    else:
        level = "High"
    return {"score": score, "level": level}


def build_daily_event_insight(event_count, impact_level):
    """Return the approved cautious wording for one forecast day."""

    if not event_count:
        return DAILY_INSIGHTS["None"]
    return DAILY_INSIGHTS.get(impact_level, DAILY_INSIGHTS["Low"])
