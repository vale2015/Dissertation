from app.utils.event_impact import (
    build_daily_event_insight,
    calculate_daily_impact,
    calculate_event_impact,
)


def test_nearby_evening_concert_is_high_impact():
    assert calculate_event_impact(1.8, "Music", "19:30:00") == {
        "score": 6,
        "level": "High",
    }


def test_distant_daytime_event_is_lower_impact():
    assert calculate_event_impact(8.0, "Other", "11:00:00") == {
        "score": 1,
        "level": "Low",
    }


def test_missing_values_do_not_invent_impact():
    assert calculate_event_impact(None, None, None) == {"score": 0, "level": "Low"}


def test_invalid_time_adds_no_score():
    assert calculate_event_impact(3, "Family", "unknown")["score"] == 3


def test_daily_impact_is_summed_and_capped():
    assert calculate_daily_impact([{"impact_score": 6}, {"impact_score": 6}]) == {
        "score": 10,
        "level": "High",
    }


def test_no_event_insight_uses_approved_wording():
    assert build_daily_event_insight(0, "None") == (
        "No Ticketmaster events were found near the restaurant."
    )


def test_medium_and_high_insights_remain_cautious():
    assert "may affect" in build_daily_event_insight(1, "Medium")
    assert "may increase" in build_daily_event_insight(2, "High")
