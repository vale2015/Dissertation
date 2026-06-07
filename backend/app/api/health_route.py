from flask import Blueprint
from app.controllers.health_controller import health, database_health

# Create a Blueprint to group all health-check related endpoints.
health_bp = Blueprint("health", __name__)

# Check if the backend API is running.
@health_bp.get("/")
def health_route():
    return health()

# Check if the backend can connect to the database.
@health_bp.get("/database")
def database_health_route():
    return database_health()


    