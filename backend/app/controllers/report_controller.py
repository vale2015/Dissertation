from time import perf_counter

from flask import Response, current_app, jsonify, request
from app.services.report_csv_service import generate_report_csv
from app.services.report_pdf_service import generate_report_pdf
from app.services.report_service import generate_management_report, ReportDateUnavailable, ReportGenerationError
from app.services.report_validation_service import validate_report_parameters, ReportValidationError


def management_report_controller(format_name="json"):
    started_at = perf_counter()
    try:
        params=validate_report_parameters(request.args.get("selected_date"),request.args.get("days_ahead"))
        report=generate_management_report(**params)
        generated_at = perf_counter()
        if format_name=="json": response=jsonify(report)
        else:
            content=generate_report_csv(report) if format_name=="csv" else generate_report_pdf(report)
            extension="csv" if format_name=="csv" else "pdf"; mime="text/csv; charset=utf-8" if extension=="csv" else "application/pdf"
            filename=f"management-report-{params['selected_date']}-{params['days_ahead']}-days.{extension}"
            response=Response(content,mimetype=mime); response.headers["Content-Disposition"]=f'attachment; filename="{filename}"'
        completed_at = perf_counter()
        generation_ms = (generated_at - started_at) * 1000
        rendering_ms = (completed_at - generated_at) * 1000
        response.headers["Server-Timing"] = (
            f"report;dur={generation_ms:.1f}, render;dur={rendering_ms:.1f}"
        )
        response.headers["Cache-Control"]="no-store"
        current_app.logger.info(
            "Management report completed: format=%s days=%s duration_ms=%.1f",
            format_name, params["days_ahead"], (completed_at - started_at) * 1000,
        )
        return response
    except ReportValidationError as error:
        return jsonify({"error":{"code":"INVALID_REPORT_PARAMETERS","message":"Invalid report parameters.","fields":error.fields}}),400
    except ReportDateUnavailable as error: return jsonify({"error":{"code":"REPORT_DATE_UNAVAILABLE","message":str(error)}}),422
    except ReportGenerationError as error: return jsonify({"error":{"code":"REPORT_UNAVAILABLE","message":str(error)}}),500
    except Exception:
        current_app.logger.exception("Unexpected management-report failure.")
        return jsonify({"error":{"code":"REPORT_GENERATION_FAILED","message":"The management report could not be generated."}}),500
