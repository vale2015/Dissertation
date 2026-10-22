from flask import Blueprint
from app.controllers.report_controller import management_report_controller
from app.controllers.report_history_controller import (
    create_report_download_link_controller, download_saved_report_controller,
    get_management_report_controller, list_management_reports_controller,
    save_management_report_controller,
)
reports_bp=Blueprint("reports",__name__)
@reports_bp.get("/management")
def management(): return management_report_controller("json")
@reports_bp.get("/management/csv")
def management_csv(): return management_report_controller("csv")
@reports_bp.get("/management/pdf")
def management_pdf(): return management_report_controller("pdf")


@reports_bp.post("/history")
def save_management_report(): return save_management_report_controller()


@reports_bp.get("/history")
def list_management_reports(): return list_management_reports_controller()


@reports_bp.get("/history/<int:report_id>")
def get_saved_management_report(report_id): return get_management_report_controller(report_id)


@reports_bp.post("/history/<int:report_id>/download-link")
def create_report_download_link(report_id): return create_report_download_link_controller(report_id)


@reports_bp.get("/history/<int:report_id>/<format_name>")
def download_saved_report(report_id, format_name):
    return download_saved_report_controller(report_id, format_name)
