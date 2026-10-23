from datetime import date

from flask import current_app, jsonify, request
from app.services.staff_cost_service import (
    ForecastRunError,
    generate_staff_cost_forecast,
    get_all_staff_cost_forecast_records,
    get_staff_cost_forecast_by_date_service,
    list_forecast_runs,
    get_forecast_run,
)

# Generate staff-cost forecasts based on the selected forecast period.
def create_staff_cost_forecast():
    try:
        days_parameter = request.args.get("days_ahead", default="7")
        if days_parameter not in ("7", "10"):
            return jsonify({"error": "days_ahead must be 7 or 10"}), 400
        days_ahead = int(days_parameter)
        selected_date = request.args.get("selected_date", default=None, type=str)
        if selected_date:
            try:
                date.fromisoformat(selected_date)
            except ValueError:
                return jsonify({"error": "selected_date must be an ISO date"}), 400

        # Call the service layer to calculate and store the staff-cost forecast.
        result = generate_staff_cost_forecast(
            days_ahead=days_ahead,
            selected_date=selected_date,
        )

        response = jsonify(result)
        response.headers["Cache-Control"] = "no-store"
        return response, 201

    except ForecastRunError as error:
        return jsonify({"error": str(error)}), 422
    except Exception:
        current_app.logger.exception("Unable to create staffing forecast run.")
        return jsonify({
            "error": "Failed to generate staff cost forecast",
        }), 500

# Return all saved staff-cost forecast records.
def get_staff_cost_forecast_records():
    try:
        result = get_all_staff_cost_forecast_records()
        return jsonify(result), 200

    except Exception as e:
        return jsonify({
            "message": "Failed to fetch staff cost forecast records",
            "error": str(e),
        }), 500

# Return staff-cost forecast records for a specific date.
def get_staff_cost_forecast_by_date(forecast_date):
    try:
        result = get_staff_cost_forecast_by_date_service(forecast_date)
        return jsonify(result), 200

    except Exception as e:
        return jsonify({
            "message": "Failed to fetch staff cost forecast by date",
            "error": str(e),
        }), 500


def list_saved_forecast_runs():
    try:
        response = jsonify({"runs": list_forecast_runs()})
        response.headers["Cache-Control"] = "no-store"
        return response
    except Exception:
        current_app.logger.exception("Unable to list forecast runs.")
        return jsonify({"error": "Forecast runs are unavailable."}), 500


def get_saved_forecast_run(run_id):
    try:
        run = get_forecast_run(run_id)
        if run is None:
            return jsonify({"error": "Forecast run not found."}), 404
        response = jsonify(run)
        response.headers["Cache-Control"] = "no-store"
        return response
    except Exception:
        current_app.logger.exception("Unable to read forecast run.")
        return jsonify({"error": "Forecast run is unavailable."}), 500
