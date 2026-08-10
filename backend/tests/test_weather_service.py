"""Tests for weather configuration, provider, normalization, and caching."""

from unittest.mock import Mock, patch

import pytest
import requests
import responses

import app.services.weather_service as weather_service
from app.services.weather_service import (
    OPEN_METEO_FORECAST_URL,
    WeatherConfigurationError,
    WeatherProviderError,
    fetch_open_meteo_weather,
    get_weather_forecast,
    load_weather_configuration,
    normalise_weather_response,
)


def test_valid_configuration(monkeypatch, weather_environment):
    for key, value in weather_environment.items():
        monkeypatch.setenv(key, value)

    configuration = load_weather_configuration()

    assert configuration["restaurant_name"] == "Rosmarino Restaurant"
    assert configuration["latitude"] == 51.4360997
    assert configuration["longitude"] == -0.1606866
    assert configuration["cache_ttl_seconds"] == 1800


@pytest.mark.parametrize(
    ("key", "value"),
    [
        ("RESTAURANT_NAME", ""),
        ("RESTAURANT_CITY", ""),
        ("RESTAURANT_LATITUDE", "invalid"),
        ("RESTAURANT_LATITUDE", "91"),
        ("RESTAURANT_LONGITUDE", "invalid"),
        ("RESTAURANT_LONGITUDE", "-181"),
        ("WEATHER_CACHE_TTL_SECONDS", "invalid"),
        ("WEATHER_CACHE_TTL_SECONDS", "0"),
    ],
)
def test_invalid_configuration(
    monkeypatch,
    weather_environment,
    key,
    value,
):
    for name, setting in weather_environment.items():
        monkeypatch.setenv(name, setting)
    monkeypatch.setenv(key, value)

    with pytest.raises(WeatherConfigurationError):
        load_weather_configuration()


def test_missing_cache_ttl_uses_default(monkeypatch, weather_environment):
    for key, value in weather_environment.items():
        monkeypatch.setenv(key, value)
    monkeypatch.delenv("WEATHER_CACHE_TTL_SECONDS")

    assert load_weather_configuration()["cache_ttl_seconds"] == 1800


@responses.activate
def test_provider_success(weather_configuration, raw_weather_payload):
    responses.get(OPEN_METEO_FORECAST_URL, json=raw_weather_payload)

    result = fetch_open_meteo_weather(weather_configuration)

    assert result == raw_weather_payload
    assert len(responses.calls) == 1
    request_url = responses.calls[0].request.url
    assert "forecast_days=7" in request_url
    assert "timezone=Europe%2FLondon" in request_url
    assert "latitude=51.4360997" in request_url


@pytest.mark.parametrize(
    "error",
    [requests.Timeout("timeout"), requests.ConnectionError("connection")],
)
def test_provider_network_errors(weather_configuration, error):
    with patch(
        "app.services.weather_service.requests.get",
        side_effect=error,
    ):
        with pytest.raises(WeatherProviderError) as caught:
            fetch_open_meteo_weather(weather_configuration)

    assert caught.value.__cause__ is error


@responses.activate
def test_provider_http_500(weather_configuration):
    responses.get(OPEN_METEO_FORECAST_URL, status=500)

    with pytest.raises(WeatherProviderError):
        fetch_open_meteo_weather(weather_configuration)


@responses.activate
def test_provider_invalid_json(weather_configuration):
    responses.get(
        OPEN_METEO_FORECAST_URL,
        body="{invalid",
        content_type="application/json",
    )

    with pytest.raises(WeatherProviderError):
        fetch_open_meteo_weather(weather_configuration)


@responses.activate
def test_provider_unexpected_response_type(weather_configuration):
    responses.get(OPEN_METEO_FORECAST_URL, json=[])

    with pytest.raises(WeatherProviderError):
        fetch_open_meteo_weather(weather_configuration)


def test_normalisation(
    raw_weather_payload,
    weather_configuration,
):
    result = normalise_weather_response(
        raw_weather_payload,
        weather_configuration,
    )

    assert result["location"]["city"] == "London"
    assert result["current"]["icon"] == "clear-day"
    assert result["today"] == result["daily_forecast"][0]
    assert len(result["daily_forecast"]) == 7
    assert result["stale"] is False
    assert result["warning"] is None


@pytest.mark.parametrize("missing", ["current", "daily"])
def test_normalisation_requires_sections(
    raw_weather_payload,
    weather_configuration,
    missing,
):
    raw_weather_payload.pop(missing)

    with pytest.raises(WeatherProviderError):
        normalise_weather_response(
            raw_weather_payload,
            weather_configuration,
        )


def test_normalisation_requires_daily_dates(
    raw_weather_payload,
    weather_configuration,
):
    raw_weather_payload["daily"]["time"] = []

    with pytest.raises(WeatherProviderError):
        normalise_weather_response(
            raw_weather_payload,
            weather_configuration,
        )


def test_normalisation_allows_optional_current_value(
    raw_weather_payload,
    weather_configuration,
):
    raw_weather_payload["current"].pop("relative_humidity_2m")

    result = normalise_weather_response(
        raw_weather_payload,
        weather_configuration,
    )

    assert result["current"]["humidity"] is None


def test_normalisation_uses_shortest_daily_array(
    raw_weather_payload,
    weather_configuration,
):
    raw_weather_payload["daily"]["sunset"] = raw_weather_payload[
        "daily"
    ]["sunset"][:3]

    result = normalise_weather_response(
        raw_weather_payload,
        weather_configuration,
    )

    assert len(result["daily_forecast"]) == 3
    assert result["daily_forecast"][1]["icon"] == "partly-cloudy-day"


def _cached_data():
    return {
        "current": {"temperature": 19},
        "stale": False,
        "warning": None,
    }


def test_cache_miss_then_hit(weather_configuration):
    fetch = Mock(return_value={})
    with (
        patch.object(
            weather_service,
            "load_weather_configuration",
            return_value=weather_configuration,
        ),
        patch.object(weather_service, "fetch_open_meteo_weather", fetch),
        patch.object(
            weather_service,
            "normalise_weather_response",
            return_value=_cached_data(),
        ),
        patch.object(weather_service.time, "monotonic", side_effect=[1, 2]),
    ):
        first = get_weather_forecast()
        second = get_weather_forecast()

    assert fetch.call_count == 1
    assert first == second
    assert first is not second


def test_cache_expiry(weather_configuration):
    fetch = Mock(return_value={})
    with (
        patch.object(
            weather_service,
            "load_weather_configuration",
            return_value=weather_configuration,
        ),
        patch.object(weather_service, "fetch_open_meteo_weather", fetch),
        patch.object(
            weather_service,
            "normalise_weather_response",
            return_value=_cached_data(),
        ),
        patch.object(
            weather_service.time,
            "monotonic",
            side_effect=[1, 1802],
        ),
    ):
        get_weather_forecast()
        get_weather_forecast()

    assert fetch.call_count == 2


def test_stale_fallback(weather_configuration):
    fetch = Mock(side_effect=[{}, WeatherProviderError("down")])
    with (
        patch.object(
            weather_service,
            "load_weather_configuration",
            return_value=weather_configuration,
        ),
        patch.object(weather_service, "fetch_open_meteo_weather", fetch),
        patch.object(
            weather_service,
            "normalise_weather_response",
            return_value=_cached_data(),
        ),
        patch.object(
            weather_service.time,
            "monotonic",
            side_effect=[1, 1802],
        ),
    ):
        get_weather_forecast()
        result = get_weather_forecast()

    assert result["stale"] is True
    assert result["warning"] == "Weather information may be out of date."


def test_provider_failure_without_stale_data(weather_configuration):
    with (
        patch.object(
            weather_service,
            "load_weather_configuration",
            return_value=weather_configuration,
        ),
        patch.object(
            weather_service,
            "fetch_open_meteo_weather",
            side_effect=WeatherProviderError("down"),
        ),
    ):
        with pytest.raises(WeatherProviderError):
            get_weather_forecast()


def test_configuration_change_invalidates_cache(weather_configuration):
    changed = {**weather_configuration, "latitude": 50.0}
    fetch = Mock(return_value={})
    with (
        patch.object(
            weather_service,
            "load_weather_configuration",
            side_effect=[weather_configuration, changed],
        ),
        patch.object(weather_service, "fetch_open_meteo_weather", fetch),
        patch.object(
            weather_service,
            "normalise_weather_response",
            return_value=_cached_data(),
        ),
        patch.object(weather_service.time, "monotonic", side_effect=[1, 2]),
    ):
        get_weather_forecast()
        get_weather_forecast()

    assert fetch.call_count == 2
