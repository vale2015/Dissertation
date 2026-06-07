from flask import Blueprint
from app.controllers.demand_controller import (
    get_demand_features,
    latest_demand,
    insert_demand,
    demand_stats,
    get_demand_by_date,
    delete_demand,
    weekly_demand,
    demand_forecast,
    training_demand_model,
)

# Create a Blueprint to group all demand-related API endpoints.
demand_bp = Blueprint("demand", __name__)

# Retrieve all restaurant demand records.
@demand_bp.get("/")
def get_all_demand():
    return get_demand_features()

# Retrieve the most recent demand record.
@demand_bp.get("/latest")
def get_latest_demand():
    return latest_demand()

# Insert a new demand record into the database.
@demand_bp.post("/")
def create_demand():
    return insert_demand()

# Retrieve summary statistics for demand data.
@demand_bp.get("/stats")
def get_stats():
    return demand_stats()

# Retrieve demand data for a specific date.
@demand_bp.get("/date/<date>")
def get_by_date(date):
    return get_demand_by_date(date)

# Delete demand data for a specific date.
@demand_bp.delete("/date/<date>")
def remove_by_date(date):
    return delete_demand(date)


@demand_bp.get("/weekly")
def get_weekly_demand():
    return weekly_demand()

# Generate a short-term demand forecast.
@demand_bp.get("/forecast")
def get_forecast():
    return demand_forecast()

# Train or retrain the machine learning demand model.
@demand_bp.get("/train")
def train_model_route():
    return training_demand_model()



