"""Protected weather API routes."""

from flask import Blueprint

from app.controllers.weather_controller import get_weather_forecast_controller


weather_bp = Blueprint("weather", __name__)


@weather_bp.get("/")
def weather_forecast_route():
    """Return weather for the configured restaurant location."""

    return get_weather_forecast_controller()
