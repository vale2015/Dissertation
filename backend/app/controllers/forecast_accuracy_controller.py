from flask import current_app, g, jsonify, request

from app.services.forecast_accuracy_service import (
    AccuracyConflictError,
    AccuracyInputError,
    correct_actual,
    get_accuracy_report,
    record_actual,
)
from app.services.permission_service import MANAGE_BOOKINGS, has_permission


def _no_store(body, status=200):
    response = jsonify(body)
    response.headers["Cache-Control"] = "no-store"
    return response, status


def _can_record_actual():
    return has_permission(g.current_user, MANAGE_BOOKINGS)


def accuracy_report():
    try:
        days = request.args.get("days", "90")
        if days not in ("30", "90", "180"):
            raise AccuracyInputError("days must be 30, 90, or 180.")
        return _no_store(get_accuracy_report(int(days)))
    except AccuracyInputError as error:
        return _no_store({"error": str(error)}, 400)
    except Exception:
        current_app.logger.exception("Unable to load forecast accuracy.")
        return _no_store({"error": "Forecast accuracy is unavailable."}, 500)


def create_actual():
    if not _can_record_actual():
        return _no_store({"error": "You cannot record actual covers."}, 403)
    body = request.get_json(silent=True)
    if not isinstance(body, dict) or set(body) != {"service_date", "actual_covers"}:
        return _no_store({"error": "service_date and actual_covers are required."}, 400)
    try:
        return _no_store(record_actual(body["service_date"], body["actual_covers"],
                                       g.current_user["id"]), 201)
    except AccuracyInputError as error:
        return _no_store({"error": str(error)}, 400)
    except AccuracyConflictError as error:
        return _no_store({"error": str(error)}, 409)
    except Exception:
        current_app.logger.exception("Unable to record actual covers.")
        return _no_store({"error": "Actual covers could not be saved."}, 500)


def update_actual(service_date):
    if not _can_record_actual():
        return _no_store({"error": "You cannot correct actual covers."}, 403)
    body = request.get_json(silent=True)
    if not isinstance(body, dict) or set(body) != {"actual_covers", "reason"}:
        return _no_store({"error": "actual_covers and reason are required."}, 400)
    try:
        return _no_store(correct_actual(service_date, body["actual_covers"], body["reason"],
                                        g.current_user["id"]))
    except AccuracyInputError as error:
        return _no_store({"error": str(error)}, 400)
    except Exception:
        current_app.logger.exception("Unable to correct actual covers.")
        return _no_store({"error": "Actual covers could not be corrected."}, 500)
