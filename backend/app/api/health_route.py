from flask import Blueprint
from app.controllers.health_controller import health, database_health

health_bp = Blueprint("health", __name__)


@health_bp.get("/")
def health_route():
    return health()


@health_bp.get("/database")
def database_health_route():
    return database_health()


    