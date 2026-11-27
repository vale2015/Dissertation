"""Generic 5xx bodies. Exception details go to the server log only."""
from flask import current_app, jsonify

INTERNAL_ERROR = "INTERNAL_ERROR"
INTERNAL_ERROR_MESSAGE = "An unexpected error occurred. Please try again later."


def internal_error_response(log_message, **extra):
    """Log the active exception and return a 500 with a stable code.

    Keeps the legacy top-level "error" string; callers may add keys such as
    "message" or "success" through ``extra`` so existing clients keep working.
    """
    current_app.logger.exception(log_message)
    body = {"error": INTERNAL_ERROR_MESSAGE, "code": INTERNAL_ERROR}
    body.update(extra)
    return jsonify(body), 500
