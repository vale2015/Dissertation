"""Shared fixtures for weather tests."""

import pytest

from app.services.weather_service import _clear_weather_cache


@pytest.fixture(autouse=True)
def clear_weather_cache():
    _clear_weather_cache()
    yield
    _clear_weather_cache()


@pytest.fixture
def weather_environment():
    return {
        "RESTAURANT_NAME": "Rosmarino Restaurant",
        "RESTAURANT_CITY": "London",
        "RESTAURANT_LATITUDE": "51.4360997",
        "RESTAURANT_LONGITUDE": "-0.1606866",
        "RESTAURANT_TIMEZONE": "Europe/London",
        "WEATHER_CACHE_TTL_SECONDS": "1800",
    }


@pytest.fixture
def weather_configuration():
    return {
        "restaurant_name": "Rosmarino Restaurant",
        "city": "London",
        "latitude": 51.4360997,
        "longitude": -0.1606866,
        "timezone": "Europe/London",
        "cache_ttl_seconds": 1800,
    }


@pytest.fixture
def raw_weather_payload():
    dates = [f"2026-08-{10 + index:02d}" for index in range(8)]
    return {
        "current": {
            "temperature_2m": 19.2,
            "apparent_temperature": 18.7,
            "relative_humidity_2m": 64,
            "precipitation": 0.4,
            "weather_code": 0,
            "wind_speed_10m": 14,
            "is_day": 1,
        },
        "daily": {
            "time": dates,
            "weather_code": [0, 1, 2, 3, 61, 71, 95, 0],
            "temperature_2m_max": [20 + index for index in range(8)],
            "temperature_2m_min": [10 + index for index in range(8)],
            "precipitation_probability_max": [
                index * 10 for index in range(8)
            ],
            "sunrise": [f"{value}T05:30" for value in dates],
            "sunset": [f"{value}T20:30" for value in dates],
        },
    }
