from flask import jsonify, request
import jwt

from app.services.auth_service import authenticate_user, decode_user_token


def login_user():
    try:
        data = request.get_json()

        if not data:
            return jsonify({"error": "Request body must be JSON"}), 400

        email = data.get("email")
        password = data.get("password")

        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400

        result = authenticate_user(email, password)

        if not result:
            return jsonify({"error": "Invalid email or password"}), 401

        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


def logout_user():
    return jsonify({
        "message": "Logout successful. Remove the token on the client side."
    }), 200


def get_current_user():
    try:
        auth_header = request.headers.get("Authorization")

        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid Authorization header"}), 401

        token = auth_header.split(" ")[1]
        result = decode_user_token(token)

        return jsonify(result), 200

    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token has expired"}), 401

    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401

    except Exception as e:
        return jsonify({"error": str(e)}), 500