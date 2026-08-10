"""Protected local-event API routes."""

from flask import Blueprint

from app.controllers.events_controller import get_local_events_controller


events_bp = Blueprint("events", __name__)


@events_bp.get("/")
def local_events_route():
    return get_local_events_controller()
