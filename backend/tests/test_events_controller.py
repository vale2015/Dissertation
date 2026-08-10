from unittest.mock import patch

import pytest

from app import create_app
from app.services.events_service import (
    EventsConfigurationError,
    EventsProviderError,
    EventsRequestError,
)


@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    return app.test_client()


def _authenticated_request(client, result=None, error=None):
    with (
        patch(
            "app.middleware.auth_middleware.decode_user_token",
            return_value={"user": {"id": 1, "role": "manager"}},
        ),
        patch(
            "app.controllers.events_controller.get_local_events",
            return_value=result,
            side_effect=error,
        ) as service,
    ):
        response = client.get(
            "/api/events/?start_date=2026-08-11&end_date=2026-08-17",
            headers={"Authorization": "Bearer test-token"},
        )
    return response, service


def test_events_endpoint_requires_authentication(client):
    assert client.get("/api/events/").status_code == 401


def test_events_controller_returns_data_and_passes_dates(client):
    data = {"days": []}
    response, service = _authenticated_request(client, result=data)
    assert response.status_code == 200
    assert response.json == {"success": True, "data": data}
    service.assert_called_once_with("2026-08-11", "2026-08-17")


@pytest.mark.parametrize(
    "error,status,message",
    [
        (EventsRequestError("private key"), 400, "A valid event date range is required."),
        (EventsConfigurationError("private key"), 500, "Local-event service is not configured."),
        (EventsProviderError("private key"), 503, "Local-event information is temporarily unavailable."),
        (RuntimeError("private key"), 500, "Local-event information is temporarily unavailable."),
    ],
)
def test_events_controller_returns_sanitised_failures(
    client, caplog, error, status, message
):
    response, _ = _authenticated_request(client, error=error)
    assert response.status_code == status
    assert response.json == {"success": False, "message": message}
    assert "private key" not in response.get_data(as_text=True)
    assert "private key" not in caplog.text
