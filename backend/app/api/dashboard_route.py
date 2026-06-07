from flask import Blueprint
from app.controllers.dashboard_controller import dashboard_metrics

# Create a Blueprint to group dashboard-related API endpoints.
dashboard_bp = Blueprint("dashboard", __name__)

# Return the main dashboard metrics used by the frontend.
@dashboard_bp.get("/")
def get_dashboard_metrics():
    return dashboard_metrics()