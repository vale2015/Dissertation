from flask import jsonify
from app.services.staffing_rules_service import get_all_staffing_rules_service


def get_all_staffing_rules():
    try:
        result = get_all_staffing_rules_service()
        return jsonify(result), 200
    except Exception as e:
        return jsonify({
            "message": "Failed to fetch staffing rules",
            "error": str(e),
        }), 500