from flask import jsonify
from app.services.dashboard_service import get_dashboard_summary

def dashboard_metrics():
    try:
        data = get_dashboard_summary()
        return jsonify(data), 200
    except Exception as e:
        return jsonify({
            "message": "Failed to load dashboard metrics",
            "error": str(e)
        }), 500