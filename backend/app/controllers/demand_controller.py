from flask import jsonify, request
from app.ml.pipelines.predict_pipeline import prediction_demand
from app.services.demand_service import (
    get_all_demand_records,
    get_latest_demand_record,
    insert_demand_record,
    get_demand_statistics,
    get_demand_record_by_date,
    delete_demand_record,
    get_weekly_demand_summary,
)


def get_demand_features():
    try:
        rows = get_all_demand_records()
        return jsonify(rows), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def latest_demand():
    try:
        row = get_latest_demand_record()

        if row:
            return jsonify(row), 200

        return jsonify({"message": "No record found"}), 404

    except Exception as e:
        return jsonify({"error": str(e)}), 500


def insert_demand():
    try:
        data = request.get_json()

        if not data:
            return jsonify({"error": "Request body must be JSON"}), 400

        required_fields = [
            "date",
            "same_day_covers",
            "walk_in_covers",
            "advance_covers",
            "avg_duration_min"
        ]

        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing field: {field}"}), 400

        result = insert_demand_record(data)
        return jsonify(result), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


def demand_stats():
    try:
        row = get_demand_statistics()
        return jsonify(row), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def get_demand_by_date(date):
    try:
        row = get_demand_record_by_date(date)

        if row:
            return jsonify(row), 200

        return jsonify({"message": "No record found"}), 404

    except Exception as e:
        return jsonify({"error": str(e)}), 500


def delete_demand(date):
    try:
        deleted_rows = delete_demand_record(date)

        if deleted_rows == 0:
            return jsonify({"message": "No record found"}), 404

        return jsonify({"message": "Record deleted"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


def weekly_demand():
    try:
        rows = get_weekly_demand_summary()
        return jsonify(rows), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def demand_forecast():
    try:
        days_ahead = request.args.get("days_ahead", type=int)
        if days_ahead is None:
            days_ahead = request.args.get("days", default=7, type=int)

        selected_date = request.args.get("selected_date")
        if selected_date is None:
            selected_date = request.args.get("date")

        if days_ahead not in [7, 10]:
            return jsonify({"error": "days_ahead must be 7 or 10"}), 400

        forecast = prediction_demand(days_ahead=days_ahead, selected_date=selected_date)
        return jsonify(forecast), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def training_demand_model():
    try:
        from app.ml.pipelines.train_pipeline import train_model
        result = train_model()
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500