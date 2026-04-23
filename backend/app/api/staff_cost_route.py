from flask import Blueprint
from app.controllers.staff_cost_controller import (
    create_staff_cost_forecast,
    get_staff_cost_forecast_records,
    get_staff_cost_forecast_by_date,
)

staff_cost_bp = Blueprint("staff_cost", __name__)


@staff_cost_bp.get("/forecast")
def generate_staff_cost():
    return create_staff_cost_forecast()

@staff_cost_bp.get("/")
def get_all_staff_cost_forecast():
    return get_staff_cost_forecast_records()

@staff_cost_bp.get("/date/<forecast_date>")
def get_staff_cost_by_date(forecast_date):
    return get_staff_cost_forecast_by_date(forecast_date)