"""Authenticated, recipient-scoped notification inbox."""

from flask import Blueprint, current_app, g, jsonify

from app.services.notification_service import list_notifications, mark_notification_read


notification_bp = Blueprint("notifications", __name__)


def _reply(body, status=200):
    response = jsonify(body)
    response.headers["Cache-Control"] = "no-store"
    return response, status


@notification_bp.get("/")
def inbox():
    try:
        return _reply(list_notifications(g.current_user["id"]))
    except Exception:
        current_app.logger.exception("Unable to list notifications")
        return _reply({"error": {"code": "NOTIFICATIONS_UNAVAILABLE", "message": "Notifications are unavailable right now."}}, 503)


@notification_bp.patch("/<int:notification_id>/read")
def mark_read(notification_id):
    try:
        result = mark_notification_read(g.current_user["id"], notification_id)
        if result is None:
            return _reply({"error": {"code": "NOTIFICATION_NOT_FOUND", "message": "Notification not found."}}, 404)
        return _reply({"notification": result})
    except Exception:
        current_app.logger.exception("Unable to mark notification read")
        return _reply({"error": {"code": "NOTIFICATIONS_UNAVAILABLE", "message": "Notification could not be updated."}}, 503)
