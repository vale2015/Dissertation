from flask import jsonify
from app.services.dashboard_service import get_dashboard_summary

# Return the main dashboard summary data to the frontend.
def dashboard_metrics():
    try:
        data = get_dashboard_summary()
        # Return an error response if the dashboard data cannot be loaded.
        return jsonify(data), 200
    except Exception as e:
        return jsonify({
            "message": "Failed to load dashboard metrics",
            "error": str(e)
        }), 500