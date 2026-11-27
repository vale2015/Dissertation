from flask import jsonify
from app.services.dashboard_service import get_dashboard_summary
from app.utils.error_responses import internal_error_response

# Return the main dashboard summary data to the frontend.
def dashboard_metrics():
    try:
        data = get_dashboard_summary()
        return jsonify(data), 200
    except Exception:
        return internal_error_response(
            "Unable to load dashboard metrics.",
            message="Failed to load dashboard metrics",
        )
