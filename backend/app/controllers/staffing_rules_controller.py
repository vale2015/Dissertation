from flask import jsonify
from app.services.staffing_rules_service import get_all_staffing_rules_service
from app.utils.error_responses import internal_error_response

# Return all staffing rules from the service layer.
def get_all_staffing_rules_controller():
    try:
        data = get_all_staffing_rules_service()

        return jsonify({
            "success": True,
            "data": data
        }), 200

    except Exception:
        return internal_error_response(
            "Unable to load staffing rules.",
            success=False,
            message="Failed to fetch staffing rules.",
        )
