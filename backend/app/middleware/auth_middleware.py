import logging

import jwt
from flask import g, jsonify, request

from app.services.auth_service import decode_user_token


logger = logging.getLogger(__name__)


# Authenticate every request handled by a protected Flask blueprint.
def require_authenticated_request():
    # Allow Flask-CORS to complete browser preflight requests.
    if request.method == "OPTIONS":
        return None

    auth_header = request.headers.get("Authorization", "")
    scheme, separator, token = auth_header.partition(" ")

    if (
        not separator
        or scheme.lower() != "bearer"
        or not token.strip()
    ):
        return jsonify({
            "error": "Authentication required"
        }), 401

    try:
        result = decode_user_token(token.strip())

        # Make the authenticated user available to controllers.
        g.current_user = result["user"]

        return None

    except jwt.ExpiredSignatureError:
        return jsonify({
            "error": "Session has expired"
        }), 401

    except jwt.InvalidTokenError:
        return jsonify({
            "error": "Invalid authentication token"
        }), 401

    except Exception:
        logger.exception("Protected API authentication failed")

        return jsonify({
            "error": "Unable to verify authentication"
        }), 500