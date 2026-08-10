"""Weather configuration, provider access, normalisation, and caching."""

import os
import time
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock

import requests
from dotenv import load_dotenv

from app.utils.weather_codes import get_weather_condition


DEFAULT_CACHE_TTL_SECONDS = 1800
OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_TIMEOUT = (3, 8)
BACKEND_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(BACKEND_ENV_PATH, override=False)

_weather_cache = {
    "configuration_key": None,
    "data": None,
    "expires_at": 0.0,
}
_weather_cache_lock = RLock()


class WeatherConfigurationError(Exception):
    """Raised when deployment-level weather configuration is invalid."""


class WeatherProviderError(Exception):
    """Raised when weather data cannot be obtained or interpreted."""


def load_weather_configuration():
    """Load and validate the deployment-level restaurant weather settings."""

    restaurant_name = os.getenv("RESTAURANT_NAME", "").strip()
    city = os.getenv("RESTAURANT_CITY", "").strip()
    timezone = os.getenv("RESTAURANT_TIMEZONE", "").strip()

    if not restaurant_name:
        raise WeatherConfigurationError("RESTAURANT_NAME must not be empty.")
    if not city:
        raise WeatherConfigurationError("RESTAURANT_CITY must not be empty.")
    if not timezone:
        raise WeatherConfigurationError("RESTAURANT_TIMEZONE must not be empty.")

    try:
        latitude = float(os.getenv("RESTAURANT_LATITUDE", "").strip())
    except (AttributeError, TypeError, ValueError) as error:
        raise WeatherConfigurationError(
            "RESTAURANT_LATITUDE must be a number between -90 and 90."
        ) from error

    if not -90 <= latitude <= 90:
        raise WeatherConfigurationError(
            "RESTAURANT_LATITUDE must be between -90 and 90."
        )

    try:
        longitude = float(os.getenv("RESTAURANT_LONGITUDE", "").strip())
    except (AttributeError, TypeError, ValueError) as error:
        raise WeatherConfigurationError(
            "RESTAURANT_LONGITUDE must be a number between -180 and 180."
        ) from error

    if not -180 <= longitude <= 180:
        raise WeatherConfigurationError(
            "RESTAURANT_LONGITUDE must be between -180 and 180."
        )

    raw_cache_ttl = os.getenv("WEATHER_CACHE_TTL_SECONDS", "").strip()
    if not raw_cache_ttl:
        cache_ttl_seconds = DEFAULT_CACHE_TTL_SECONDS
    else:
        try:
            cache_ttl_seconds = int(raw_cache_ttl)
        except ValueError as error:
            raise WeatherConfigurationError(
                "WEATHER_CACHE_TTL_SECONDS must be a positive integer."
            ) from error

    if cache_ttl_seconds <= 0:
        raise WeatherConfigurationError(
            "WEATHER_CACHE_TTL_SECONDS must be a positive integer."
        )

    return {
        "restaurant_name": restaurant_name,
        "city": city,
        "latitude": latitude,
        "longitude": longitude,
        "timezone": timezone,
        "cache_ttl_seconds": cache_ttl_seconds,
    }


def fetch_open_meteo_weather(configuration):
    """Fetch current conditions and a seven-day forecast from Open-Meteo."""

    parameters = {
        "latitude": configuration["latitude"],
        "longitude": configuration["longitude"],
        "current": ",".join(
            [
                "temperature_2m",
                "apparent_temperature",
                "relative_humidity_2m",
                "precipitation",
                "weather_code",
                "wind_speed_10m",
                "is_day",
            ]
        ),
        "daily": ",".join(
            [
                "weather_code",
                "temperature_2m_max",
                "temperature_2m_min",
                "precipitation_probability_max",
                "sunrise",
                "sunset",
            ]
        ),
        "temperature_unit": "celsius",
        "wind_speed_unit": "kmh",
        "precipitation_unit": "mm",
        "forecast_days": 7,
        "timezone": configuration["timezone"],
    }

    try:
        response = requests.get(
            OPEN_METEO_FORECAST_URL,
            params=parameters,
            timeout=OPEN_METEO_TIMEOUT,
        )
        response.raise_for_status()
        raw_data = response.json()
    except (requests.RequestException, ValueError) as error:
        raise WeatherProviderError(
            "Open-Meteo request failed."
        ) from error

    if not isinstance(raw_data, dict):
        error = TypeError("Open-Meteo response must be a JSON object.")
        raise WeatherProviderError(
            "Open-Meteo returned an unexpected response."
        ) from error

    return raw_data


def _is_daytime(value):
    """Convert Open-Meteo's numeric day flag to a Boolean."""

    if isinstance(value, bool):
        return value
    try:
        return int(value) == 1
    except (TypeError, ValueError):
        return False


def normalise_weather_response(raw_data, configuration):
    """Convert Open-Meteo data into the application's weather contract."""

    current = raw_data.get("current")
    daily = raw_data.get("daily")

    if not isinstance(current, dict):
        raise WeatherProviderError("Weather response is missing current data.")
    if not isinstance(daily, dict):
        raise WeatherProviderError("Weather response is missing daily data.")

    daily_fields = [
        "time",
        "weather_code",
        "temperature_2m_max",
        "temperature_2m_min",
        "precipitation_probability_max",
        "sunrise",
        "sunset",
    ]
    daily_arrays = []
    for field in daily_fields:
        values = daily.get(field)
        if not isinstance(values, list):
            raise WeatherProviderError(
                f"Weather response daily field {field} must be a list."
            )
        daily_arrays.append(values)

    if not daily["time"]:
        raise WeatherProviderError("Weather response is missing daily dates.")

    entry_count = min(min(len(values) for values in daily_arrays), 7)
    if entry_count < 1:
        raise WeatherProviderError(
            "Weather response contains no complete daily entries."
        )

    current_is_day = _is_daytime(current.get("is_day"))
    current_condition = get_weather_condition(
        current.get("weather_code"),
        current_is_day,
    )

    daily_forecast = []
    for index in range(entry_count):
        daily_condition = get_weather_condition(
            daily["weather_code"][index],
            is_day=True,
        )
        daily_forecast.append(
            {
                "date": daily["time"][index],
                "temperature_max": daily["temperature_2m_max"][index],
                "temperature_min": daily["temperature_2m_min"][index],
                "precipitation_probability": daily[
                    "precipitation_probability_max"
                ][index],
                "sunrise": daily["sunrise"][index],
                "sunset": daily["sunset"][index],
                **daily_condition,
            }
        )

    fetched_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    return {
        "location": {
            "restaurant_name": configuration["restaurant_name"],
            "city": configuration["city"],
            "timezone": configuration["timezone"],
        },
        "current": {
            "temperature": current.get("temperature_2m"),
            "apparent_temperature": current.get("apparent_temperature"),
            "humidity": current.get("relative_humidity_2m"),
            "precipitation": current.get("precipitation"),
            "wind_speed": current.get("wind_speed_10m"),
            "is_day": current_is_day,
            **current_condition,
        },
        "today": daily_forecast[0].copy(),
        "daily_forecast": daily_forecast,
        "fetched_at": fetched_at,
        "stale": False,
        "warning": None,
    }


def _configuration_cache_key(configuration):
    """Return the settings that uniquely identify one weather cache entry."""

    return (
        configuration["restaurant_name"],
        configuration["city"],
        configuration["latitude"],
        configuration["longitude"],
        configuration["timezone"],
        configuration["cache_ttl_seconds"],
    )


def _clear_weather_cache():
    """Clear the in-memory cache; used to isolate automated tests."""

    with _weather_cache_lock:
        _weather_cache["configuration_key"] = None
        _weather_cache["data"] = None
        _weather_cache["expires_at"] = 0.0


def get_weather_forecast():
    """Return cached or newly fetched weather with stale-data fallback."""

    configuration = load_weather_configuration()
    configuration_key = _configuration_cache_key(configuration)

    with _weather_cache_lock:
        if _weather_cache["configuration_key"] != configuration_key:
            _weather_cache["configuration_key"] = configuration_key
            _weather_cache["data"] = None
            _weather_cache["expires_at"] = 0.0

        now = time.monotonic()
        if (
            _weather_cache["data"] is not None
            and now < _weather_cache["expires_at"]
        ):
            return deepcopy(_weather_cache["data"])

        try:
            raw_data = fetch_open_meteo_weather(configuration)
            normalised_data = normalise_weather_response(
                raw_data,
                configuration,
            )
        except WeatherProviderError:
            if _weather_cache["data"] is None:
                raise

            stale_data = deepcopy(_weather_cache["data"])
            stale_data["stale"] = True
            stale_data["warning"] = (
                "Weather information may be out of date."
            )
            return stale_data

        _weather_cache["data"] = deepcopy(normalised_data)
        _weather_cache["expires_at"] = (
            now + configuration["cache_ttl_seconds"]
        )
        return deepcopy(normalised_data)
