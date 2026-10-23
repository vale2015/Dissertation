from flask import Blueprint
from app.controllers.staff_cost_controller import (
    create_staff_cost_forecast,
    get_staff_cost_forecast_records,
    get_staff_cost_forecast_by_date,
    list_saved_forecast_runs,
    get_saved_forecast_run,
)

staff_cost_bp = Blueprint("staff_cost", __name__)

# Generate staff-cost forecast records.
@staff_cost_bp.post("/forecast")
def generate_staff_cost():
    return create_staff_cost_forecast()

@staff_cost_bp.get("/")
def get_all_staff_cost_forecast():
    return get_staff_cost_forecast_records()

@staff_cost_bp.get("/runs")
def get_runs():
    return list_saved_forecast_runs()

@staff_cost_bp.get("/runs/<int:run_id>")
def get_run(run_id):
    return get_saved_forecast_run(run_id)

@staff_cost_bp.get("/date/<forecast_date>")
def get_staff_cost_by_date(forecast_date):
    return get_staff_cost_forecast_by_date(forecast_date)
