"""Translate Open-Meteo WMO weather codes into application values."""


UNKNOWN_CONDITION = {
    "condition": "Unknown conditions",
    "icon": "unknown",
}


WEATHER_CODE_MAPPING = {
    0: ("Clear sky", "clear"),
    1: ("Mainly clear", "partly-cloudy"),
    2: ("Partly cloudy", "partly-cloudy"),
    3: ("Overcast", "cloudy"),
    45: ("Fog", "fog"),
    48: ("Depositing rime fog", "fog"),
    51: ("Light drizzle", "drizzle"),
    53: ("Moderate drizzle", "drizzle"),
    55: ("Dense drizzle", "drizzle"),
    56: ("Light freezing drizzle", "drizzle"),
    57: ("Dense freezing drizzle", "drizzle"),
    61: ("Light rain", "rain"),
    63: ("Moderate rain", "rain"),
    65: ("Heavy rain", "heavy-rain"),
    66: ("Light freezing rain", "rain"),
    67: ("Heavy freezing rain", "heavy-rain"),
    71: ("Light snowfall", "snow"),
    73: ("Moderate snowfall", "snow"),
    75: ("Heavy snowfall", "heavy-snow"),
    77: ("Snow grains", "snow"),
    80: ("Light rain showers", "rain"),
    81: ("Moderate rain showers", "rain"),
    82: ("Violent rain showers", "heavy-rain"),
    85: ("Light snow showers", "snow"),
    86: ("Heavy snow showers", "heavy-snow"),
    95: ("Thunderstorm", "thunderstorm"),
    96: ("Thunderstorm with light hail", "thunderstorm"),
    99: ("Thunderstorm with heavy hail", "thunderstorm"),
}


def get_weather_condition(weather_code, is_day=True):
    """Return a stable condition label and local icon identifier."""

    if weather_code is None or isinstance(weather_code, bool):
        return UNKNOWN_CONDITION.copy()

    try:
        code = int(weather_code)
    except (TypeError, ValueError):
        return UNKNOWN_CONDITION.copy()

    mapping = WEATHER_CODE_MAPPING.get(code)
    if mapping is None:
        return UNKNOWN_CONDITION.copy()

    condition, icon = mapping
    if icon == "clear":
        icon = "clear-day" if is_day else "clear-night"
    elif icon == "partly-cloudy":
        icon = "partly-cloudy-day" if is_day else "partly-cloudy-night"

    return {
        "condition": condition,
        "icon": icon,
    }
