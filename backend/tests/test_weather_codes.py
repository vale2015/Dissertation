"""Tests for stable WMO weather-code mappings."""

import pytest

from app.utils.weather_codes import get_weather_condition


@pytest.mark.parametrize(
    ("code", "is_day", "icon"),
    [
        (0, True, "clear-day"),
        (0, False, "clear-night"),
        (61, True, "rain"),
        (71, True, "snow"),
        (95, True, "thunderstorm"),
        (999, True, "unknown"),
        (None, True, "unknown"),
        ("invalid", True, "unknown"),
    ],
)
def test_weather_code_mapping(code, is_day, icon):
    assert get_weather_condition(code, is_day)["icon"] == icon


def test_numeric_string_is_accepted():
    assert get_weather_condition("2")["icon"] == "partly-cloudy-day"
