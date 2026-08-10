"""Tests for protected weather controller responses."""

from unittest.mock import patch

import pytest

from app import create_app
from app.services.weather_service import (
    WeatherConfigurationError,
    WeatherProviderError,
)


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    return app.test_client()


def _authenticated_request(client, result=None, error=None):
    auth_result = {"user": {"id": 1, "role": "manager"}}
    with (
        patch(
            "app.middleware.auth_middleware.decode_user_token",
            return_value=auth_result,
        ),
        patch(
            "app.controllers.weather_controller.get_weather_forecast",
            return_value=result,
            side_effect=error,
        ),
    ):
        return client.get(
            "/api/weather/",
            headers={"Authorization": "Bearer test-token"},
        )


def test_weather_endpoint_requires_authentication(client):
    assert client.get("/api/weather/").status_code == 401


def test_controller_success(client):
    data = {"current": {"temperature": 19}}
    response = _authenticated_request(client, result=data)

    assert response.status_code == 200
    assert response.json == {"success": True, "data": data}


@pytest.mark.parametrize(
    ("error", "status", "message"),
    [
        (
            WeatherConfigurationError("private configuration detail"),
            500,
            "Weather service is not configured.",
        ),
        (
            WeatherProviderError("private provider detail"),
            503,
            "Weather information is temporarily unavailable.",
        ),
        (
            RuntimeError("private unexpected detail"),
            500,
            "Weather information is temporarily unavailable.",
        ),
    ],
)
def test_controller_safe_failures(client, error, status, message):
    response = _authenticated_request(client, error=error)

    assert response.status_code == status
    assert response.json == {"success": False, "message": message}
    assert "private" not in response.get_data(as_text=True)
