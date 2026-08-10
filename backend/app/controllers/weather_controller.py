"""HTTP response handling for restaurant weather."""

from flask import current_app, jsonify

from app.services.weather_service import (
    WeatherConfigurationError,
    WeatherProviderError,
    get_weather_forecast,
)


def get_weather_forecast_controller():
    """Return normalized weather without exposing internal errors."""

    try:
        weather = get_weather_forecast()
        return jsonify({"success": True, "data": weather}), 200
    except WeatherConfigurationError:
        current_app.logger.exception("Weather configuration is invalid.")
        return jsonify(
            {
                "success": False,
                "message": "Weather service is not configured.",
            }
        ), 500
    except WeatherProviderError:
        current_app.logger.exception("Weather provider request failed.")
        return jsonify(
            {
                "success": False,
                "message": "Weather information is temporarily unavailable.",
            }
        ), 503
    except Exception:
        current_app.logger.exception("Unexpected weather service failure.")
        return jsonify(
            {
                "success": False,
                "message": "Weather information is temporarily unavailable.",
            }
        ), 500
