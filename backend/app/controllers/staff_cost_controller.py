from flask import jsonify, request
from app.services.staff_cost_service import (
    generate_staff_cost_forecast,
    get_all_staff_cost_forecast_records,
    get_staff_cost_forecast_by_date_service,
)


def create_staff_cost_forecast():
    try:
        days_ahead = request.args.get("days_ahead", default=7, type=int)
        selected_date = request.args.get("selected_date", default=None, type=str)

        result = generate_staff_cost_forecast(
            days_ahead=days_ahead,
            selected_date=selected_date,
        )

        return jsonify(result), 200

    except Exception as e:
        return jsonify({
            "message": "Failed to generate staff cost forecast",
            "error": str(e),
        }), 500


def get_staff_cost_forecast_records():
    try:
        result = get_all_staff_cost_forecast_records()
        return jsonify(result), 200

    except Exception as e:
        return jsonify({
            "message": "Failed to fetch staff cost forecast records",
            "error": str(e),
        }), 500


def get_staff_cost_forecast_by_date(forecast_date):
    try:
        result = get_staff_cost_forecast_by_date_service(forecast_date)
        return jsonify(result), 200

    except Exception as e:
        return jsonify({
            "message": "Failed to fetch staff cost forecast by date",
            "error": str(e),
        }), 500