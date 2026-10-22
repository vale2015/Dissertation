"""Authenticated report-history endpoints."""

from flask import Response, current_app, g, jsonify, request

from app.services.report_csv_service import generate_report_csv
from app.services.report_history_service import (
    ReportHistoryError, create_download_token, get_report, get_report_file,
    list_reports, report_exists, save_report, valid_download_token,
)
from app.services.report_pdf_service import generate_report_pdf
from app.services.report_service import (
    ReportDateUnavailable, ReportGenerationError, generate_management_report,
)
from app.services.report_validation_service import ReportValidationError, validate_report_parameters


def _error(code, message, status):
    response = jsonify({"error": {"code": code, "message": message}})
    response.headers["Cache-Control"] = "no-store"
    return response, status


def save_management_report_controller():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return _error("INVALID_REPORT_PARAMETERS", "A JSON request body is required.", 400)
    try:
        params = validate_report_parameters(body.get("selected_date"), body.get("days_ahead"))
        report = generate_management_report(**params)
        saved = save_report(report, generate_report_pdf(report), generate_report_csv(report),
                            g.current_user["id"])
        response = jsonify({"report": saved})
        response.status_code = 201
        response.headers["Cache-Control"] = "no-store"
        return response
    except ReportValidationError as error:
        response = jsonify({"error": {"code": "INVALID_REPORT_PARAMETERS",
                                    "message": "Invalid report parameters.", "fields": error.fields}})
        response.headers["Cache-Control"] = "no-store"
        return response, 400
    except ReportDateUnavailable as error:
        return _error("REPORT_DATE_UNAVAILABLE", str(error), 422)
    except ReportGenerationError:
        return _error("REPORT_UNAVAILABLE", "The report could not be generated.", 500)
    except ReportHistoryError as error:
        return _error("REPORT_TOO_LARGE", str(error), 413)
    except Exception:
        current_app.logger.exception("Unable to save management report.")
        return _error("REPORT_SAVE_FAILED", "The report could not be saved.", 500)


def list_management_reports_controller():
    try:
        response = jsonify(list_reports(request.args.get("cursor")))
        response.headers["Cache-Control"] = "no-store"
        return response
    except ReportHistoryError as error:
        return _error("INVALID_CURSOR", str(error), 400)
    except Exception:
        current_app.logger.exception("Unable to list management reports.")
        return _error("REPORT_HISTORY_UNAVAILABLE", "Past reports are unavailable.", 500)


def get_management_report_controller(report_id):
    try:
        report = get_report(report_id)
        if report is None:
            return _error("REPORT_NOT_FOUND", "Report not found.", 404)
        response = jsonify(report)
        response.headers["Cache-Control"] = "no-store"
        return response
    except Exception:
        current_app.logger.exception("Unable to read saved management report.")
        return _error("REPORT_HISTORY_UNAVAILABLE", "Past report is unavailable.", 500)


def create_report_download_link_controller(report_id):
    body = request.get_json(silent=True)
    format_name = body.get("format") if isinstance(body, dict) else None
    if format_name not in ("pdf", "csv"):
        return _error("INVALID_REPORT_FORMAT", "Choose PDF or CSV.", 400)
    try:
        if not report_exists(report_id):
            return _error("REPORT_NOT_FOUND", "Report not found.", 404)
        token = create_download_token(report_id, format_name, g.current_user["id"])
        response = jsonify({"url": f"/api/backend/reports/history/{report_id}/{format_name}?token={token}",
                            "expires_in_seconds": 300})
        response.headers["Cache-Control"] = "no-store"
        return response
    except Exception:
        current_app.logger.exception("Unable to create report download link.")
        return _error("REPORT_HISTORY_UNAVAILABLE", "Download is unavailable.", 500)


def download_saved_report_controller(report_id, format_name):
    token = request.args.get("token", "")
    if not valid_download_token(token, report_id, format_name, g.current_user["id"]):
        return _error("INVALID_DOWNLOAD_LINK", "Download link is invalid or expired.", 403)
    try:
        saved = get_report_file(report_id, format_name)
        if saved is None:
            return _error("REPORT_NOT_FOUND", "Report not found.", 404)
        mime = "application/pdf" if format_name == "pdf" else "text/csv; charset=utf-8"
        filename = f"management-report-{saved['selected_date']}-{saved['days_ahead']}-days.{format_name}"
        response = Response(bytes(saved["content"]), mimetype=mime)
        response.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
        response.headers["Cache-Control"] = "no-store"
        return response
    except Exception:
        current_app.logger.exception("Unable to download saved management report.")
        return _error("REPORT_HISTORY_UNAVAILABLE", "Download is unavailable.", 500)
