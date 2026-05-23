from flask import jsonify
from app.services.staffing_rules_service import get_all_staffing_rules_service


def get_all_staffing_rules_controller():
    try:
        data = get_all_staffing_rules_service()

        return jsonify({
            "success": True,
            "data": data
        }), 200

    except Exception as error:
        print("GET STAFFING RULES ERROR:", error)

        return jsonify({
            "success": False,
            "message": str(error)
        }), 500