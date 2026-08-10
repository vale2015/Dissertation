"""Safe HTTP responses for local-event context."""

from flask import current_app, jsonify, request

from app.services.events_service import (
    EventsConfigurationError,
    EventsProviderError,
    EventsRequestError,
    get_local_events,
)


def get_local_events_controller():
    """Return local events for an authenticated forecast date range."""

    try:
        data = get_local_events(
            request.args.get("start_date"),
            request.args.get("end_date"),
        )
        return jsonify({"success": True, "data": data}), 200
    except EventsRequestError:
        current_app.logger.warning("Invalid local-event date range.")
        return jsonify(
            {"success": False, "message": "A valid event date range is required."}
        ), 400
    except EventsConfigurationError:
        current_app.logger.error("Local-event service configuration is invalid.")
        return jsonify(
            {"success": False, "message": "Local-event service is not configured."}
        ), 500
    except EventsProviderError as error:
        provider_reason = {
            "The local-event provider credentials are invalid.": "credentials_invalid",
            "The local-event provider quota is unavailable.": "quota_unavailable",
            "The local-event provider is temporarily unavailable.": "provider_unavailable",
            "The local-event provider returned an invalid response.": "invalid_response",
        }.get(str(error), "provider_request_failed")
        current_app.logger.error(
            "Local-event provider request failed (%s).",
            provider_reason,
        )
        return jsonify(
            {
                "success": False,
                "message": "Local-event information is temporarily unavailable.",
            }
        ), 503
    except Exception:
        current_app.logger.error("Unexpected local-event service failure.")
        return jsonify(
            {
                "success": False,
                "message": "Local-event information is temporarily unavailable.",
            }
        ), 500
