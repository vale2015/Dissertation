from flask import Blueprint
from app.controllers.report_controller import management_report_controller
reports_bp=Blueprint("reports",__name__)
@reports_bp.get("/management")
def management(): return management_report_controller("json")
@reports_bp.get("/management/csv")
def management_csv(): return management_report_controller("csv")
@reports_bp.get("/management/pdf")
def management_pdf(): return management_report_controller("pdf")
