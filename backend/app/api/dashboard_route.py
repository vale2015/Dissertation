from flask import Blueprint
from app.controllers.dashboard_controller import dashboard_metrics

dashboard_bp = Blueprint("dashboard", __name__)

@dashboard_bp.get("/")
def get_dashboard_metrics():
    return dashboard_metrics()