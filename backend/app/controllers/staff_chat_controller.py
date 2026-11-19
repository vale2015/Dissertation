"""Protected staff-chat action endpoints; no model or browser-side writes."""

import json
import logging

from flask import g, jsonify, request
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.exceptions import RequestEntityTooLarge

from app.services.auth_rate_limit_service import reserve_chat_model_attempt, reserve_staff_chat_attempt
from app.services.staff_service import DuplicateStaff, StaffConflict, StaffNotFound
from app.services.staff_chat_service import (
    cancel_action,
    confirm_action,
    create_action,
    current_action,
    get_action,
    lookup_staff,
    patch_action,
    review_action,
    StaffChatForbidden,
)
from app.services.staff_validation_service import StaffValidationError

logger = logging.getLogger(__name__)


def _response(body, status=200, retry_after=None):
    response = jsonify(body)
    response.status_code = status
    response.headers["Cache-Control"] = "no-store"
    if retry_after is not None:
        response.headers["Retry-After"] = str(retry_after)
    return response


def _respond(function, success=200):
    try:
        retry_after = reserve_staff_chat_attempt(g.current_user["id"])
        if retry_after:
            return _response({"error": {"code": "STAFF_CHAT_THROTTLED", "message": "Too many staff requests. Please try again later."}}, 429, retry_after)
        return _response(function(), success)
    except StaffValidationError as error:
        return _response({"error": {"code": "INVALID_STAFF_FIELDS", "message": "Check the highlighted fields.", "fields": error.fields}}, 400)
    except DuplicateStaff as error:
        return _response({"error": {"code": "DUPLICATE_EMAIL", "message": str(error)}}, 409)
    except StaffConflict as error:
        return _response({"error": {"code": "STAFF_CONFLICT", "message": str(error)}}, 409)
    except StaffNotFound:
        return _response({"error": {"code": "STAFF_NOT_FOUND", "message": "Staff-chat action or account not found."}}, 404)
    except StaffChatForbidden:
        return _response({"error": {"code": "FORBIDDEN", "message": "An active manager account is required."}}, 403)
    except Exception as error:
        # SQLAlchemy tracebacks can include bind parameters. Never log bodies,
        # passwords, draft PII, raw exception messages, or a traceback here.
        category = "database" if isinstance(error, SQLAlchemyError) else "internal"
        logger.error("Staff-chat request failed (%s).", category)
        return _response({"error": {"code": "STAFF_CHAT_UNAVAILABLE", "message": "Staff management is temporarily unavailable."}}, 503)


def _body():
    request.max_content_length = 2048
    if not request.is_json:
        raise StaffValidationError({"body": "Send a JSON object."})
    try:
        raw = request.get_data(cache=False)
    except RequestEntityTooLarge as error:
        raise StaffValidationError({"body": "Request is too large."}) from error
    if len(raw) > 2048:
        raise StaffValidationError({"body": "Request is too large."})
    try:
        return json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise StaffValidationError({"body": "Send valid JSON."}) from error


def _no_body():
    request.max_content_length = 2048
    try:
        body = request.get_data(cache=False)
    except RequestEntityTooLarge as error:
        raise StaffValidationError({"body": "This action does not accept a request body."}) from error
    if body:
        raise StaffValidationError({"body": "This action does not accept a request body."})


def lookup_controller():
    return _respond(lambda: lookup_staff(request.args.get("query")))


def current_controller():
    return _respond(lambda: current_action(g.current_user["id"]))


def create_controller():
    return _respond(lambda: create_action(g.current_user["id"], _body()), 201)


def detail_controller(action_id):
    return _respond(lambda: get_action(action_id, g.current_user["id"]))


def patch_controller(action_id):
    return _respond(lambda: patch_action(action_id, g.current_user["id"], _body()))


def review_controller(action_id):
    def action():
        _no_body()
        return review_action(action_id, g.current_user["id"])
    return _respond(action)


def confirm_controller(action_id):
    return _respond(lambda: confirm_action(action_id, g.current_user["id"], _body()))


def cancel_controller(action_id):
    def action():
        _no_body()
        return cancel_action(action_id, g.current_user["id"])
    return _respond(action)


def model_budget_controller():
    def action():
        if _body() != {}:
            raise StaffValidationError({"body": "The model budget accepts an empty JSON object only."})
        retry_after = reserve_chat_model_attempt(g.current_user["id"])
        if retry_after:
            return None, retry_after
        return {"allowed": True, "limits": {"per_actor_per_minute": 5, "per_actor_per_day": 50, "global_per_day": 200}}, 0

    # The budget endpoint has its own shared limits. Do not let the generic
    # responder JSON-encode the throttle tuple as a successful allowance.
    try:
        body, retry_after = action()
        if retry_after:
            return _response({"error": {"code": "CHAT_MODEL_THROTTLED", "message": "AI interpretation has reached its usage limit. Please try again later."}}, 429, retry_after)
        return _response(body)
    except StaffValidationError as error:
        return _response({"error": {"code": "INVALID_STAFF_FIELDS", "message": "Send an empty JSON object.", "fields": error.fields}}, 400)
    except Exception:
        logger.error("Chat model usage reservation unavailable.")
        return _response({"error": {"code": "CHAT_MODEL_BUDGET_UNAVAILABLE", "message": "AI interpretation is temporarily unavailable."}}, 503)
