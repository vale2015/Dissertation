from flask import request, jsonify
from datetime import datetime
from app.services.booking_service import (
    create_booking_and_sync_features,
    fetch_all_bookings_service,
    fetch_booking_by_id_service,
    update_booking_and_sync_features,
    delete_booking_and_sync_features
)


# Checks whether the provided booking date falls on a Monday.
# This is used because the restaurant is closed on Mondays.
def is_monday(date_string):
    try:
        booking_date = datetime.strptime(str(date_string), "%Y-%m-%d")
        return booking_date.weekday() == 0
    except ValueError:
        return None


# Validates optional text fields before they are sent to the service layer.
# This helps keep input clean and reduces the risk of unsafe content being stored.
def validate_text_field(value, field_name, max_length):
    if value is None:
        return None

    if not isinstance(value, str):
        return f"{field_name} must be a string"

    if len(value.strip()) > max_length:
        return f"{field_name} must be at most {max_length} characters"

    return None


# Handles the creation of a new booking.
def add_booking():
    try:
        data = request.get_json()

        if not data:
            return jsonify({"error": "Request body is required"}), 400

        required_fields = ["booking_date", "booking_time", "party_size", "booking_type"]

        for field in required_fields:
            if field not in data or data[field] in [None, ""]:
                return jsonify({"error": f"{field} is required"}), 400

        monday_check = is_monday(data["booking_date"])

        if monday_check is None:
            return jsonify({
                "error": "Invalid booking_date format. Use YYYY-MM-DD."
            }), 400

        if monday_check:
            return jsonify({
                "error": "Bookings cannot be added on Monday because the restaurant is closed."
            }), 400

        try:
            data["party_size"] = int(data["party_size"])
        except (ValueError, TypeError):
            return jsonify({"error": "party_size must be a valid number"}), 400

        if data["party_size"] <= 0:
            return jsonify({"error": "party_size must be greater than 0"}), 400

        data["booking_type"] = str(data["booking_type"]).strip().lower()

        allowed_types = ["walk_in", "same_day", "advance"]
        if data["booking_type"] not in allowed_types:
            return jsonify({
                "error": "Invalid booking_type. Use walk_in, same_day, or advance."
            }), 400

        name_error = validate_text_field(data.get("customer_name"), "customer_name", 100)
        if name_error:
            return jsonify({"error": name_error}), 400

        notes_error = validate_text_field(data.get("notes"), "notes", 500)
        if notes_error:
            return jsonify({"error": notes_error}), 400

        booking = create_booking_and_sync_features(data)

        return jsonify({
            "message": "Booking added successfully",
            "booking": booking
        }), 201

    except Exception as e:
        print("ADD BOOKING ERROR:", str(e))
        return jsonify({"error": "Internal server error"}), 500

# Returns all bookings.
def get_all_bookings():
    try:
        # Fetch all bookings from the service layer.
        bookings = fetch_all_bookings_service()

        # Return them in JSON format.
        return jsonify({"bookings": bookings}), 200

    except Exception:
        # Avoid returning raw exception messages.
        return jsonify({"error": "Internal server error"}), 500


# Returns one booking by its ID.
def get_booking_by_id(booking_id):
    try:
        # Fetch the booking from the service layer.
        booking = fetch_booking_by_id_service(booking_id)

        # If no booking is found, return a 404 error.
        if not booking:
            return jsonify({"error": "Booking not found"}), 404

        # Return the matching booking.
        return jsonify({"booking": booking}), 200

    except Exception:
        # Avoid exposing server-side errors.
        return jsonify({"error": "Internal server error"}), 500


# Handles updates to an existing booking.
def update_booking(booking_id):
    try:
        # Read JSON data from the request body.
        data = request.get_json()

        # Stop the request if no JSON body was sent.
        if not data:
            return jsonify({"error": "Request body is required"}), 400

        # Check whether the booking exists before trying to update it.
        existing_booking = fetch_booking_by_id_service(booking_id)
        if not existing_booking:
            return jsonify({"error": "Booking not found"}), 404

        # Validate party_size if it is included in the update.
        if "party_size" in data:
            try:
                data["party_size"] = int(data["party_size"])
            except (ValueError, TypeError):
                return jsonify({"error": "party_size must be a valid number"}), 400

            if data["party_size"] <= 0:
                return jsonify({"error": "party_size must be greater than 0"}), 400

        # Validate booking_type if it is included in the update.
        if "booking_type" in data:
            allowed_types = ["walk_in", "same_day", "advance"]
            if data["booking_type"] not in allowed_types:
                return jsonify({"error": "Invalid booking_type"}), 400

        # Validate optional text fields if they are included in the update.
        if "customer_name" in data:
            name_error = validate_text_field(data.get("customer_name"), "customer_name", 100)
            if name_error:
                return jsonify({"error": name_error}), 400

        if "notes" in data:
            notes_error = validate_text_field(data.get("notes"), "notes", 500)
            if notes_error:
                return jsonify({"error": notes_error}), 400

        # Use the new booking date if provided;
        # otherwise keep the existing booking date.
        booking_date_to_check = data.get("booking_date", existing_booking["booking_date"])

        # Prevent moving a booking to Monday.
        if is_monday(str(booking_date_to_check)):
            return jsonify({
                "error": "Bookings cannot be moved to Monday because the restaurant is closed."
            }), 400

        # Pass validated data to the service layer for update and sync.
        updated_booking = update_booking_and_sync_features(booking_id, data)

        # Return the updated booking.
        return jsonify({
            "message": "Booking updated successfully",
            "booking": updated_booking
        }), 200

    except Exception:
        # Return a generic error response.
        return jsonify({"error": "Internal server error"}), 500


# Handles deletion of a booking.
def delete_booking(booking_id):
    try:
        # Ask the service layer to delete the booking and update aggregates.
        deleted = delete_booking_and_sync_features(booking_id)

        # If the booking did not exist, return 404.
        if not deleted:
            return jsonify({"error": "Booking not found"}), 404

        # Confirm successful deletion.
        return jsonify({
            "message": "Booking deleted successfully"
        }), 200

    except Exception:
        # Return a generic error instead of the raw exception.
        return jsonify({"error": "Internal server error"}), 500