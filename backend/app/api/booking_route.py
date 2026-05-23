from flask import Blueprint
from app.controllers.booking_controller import (
    add_booking,
    get_all_bookings,
    get_booking_by_id,
    update_booking,
    delete_booking
)

booking_bp = Blueprint("booking_bp", __name__)

@booking_bp.route("/", methods=["GET"])
def fetch_bookings_route():
    return get_all_bookings()

@booking_bp.route("/<int:booking_id>", methods=["GET"])
def fetch_booking_by_id_route(booking_id):
    return get_booking_by_id(booking_id)

@booking_bp.route("/add", methods=["POST"])
def create_booking_route():
    return add_booking()

@booking_bp.route("/<int:booking_id>", methods=["PUT"])
def update_booking_route(booking_id):
    return update_booking(booking_id)

@booking_bp.route("/<int:booking_id>", methods=["DELETE"])
def delete_booking_route(booking_id):
    return delete_booking(booking_id)


