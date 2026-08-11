import logging
from flask import jsonify, request, g
import jwt

from app.services.auth_service import authenticate_user, decode_user_token, update_own_profile
from app.services.account_activation_service import validate_account_token,complete_account_token,InvalidAccountToken
from app.services.account_token_service import PURPOSE_ACTIVATION,PURPOSE_RESET
from app.services.staff_validation_service import StaffValidationError
logger=logging.getLogger(__name__)

# Validate login details and return a JWT token if authentication succeeds
def login_user():
    try:
        data = request.get_json()

        if not data:
            return jsonify({"error": "Request body must be JSON"}), 400

        email = data.get("email")
        password = data.get("password")

        # Ensure both email and password are provided.
        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400
        
        # Check the user credentials through the authentication service.
        result = authenticate_user(email, password)

        if not result:
            return jsonify({"error": "Invalid email or password"}), 401

        return jsonify(result), 200

    except Exception:
        logger.exception("Authentication service failed.")
        return jsonify({"error": "Authentication service is temporarily unavailable."}), 500

# Handles logout by telling the frontend to remove the saved token.
def logout_user():
    return jsonify({
        "message": "Logout successful. Remove the token on the client side."
    }), 200

# Checks the JWT token and returns the current logged-in user.
def get_current_user():
    try:
        # Read the Authorization header from the request.
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

    except Exception:
        logger.exception("Session verification failed.")
        return jsonify({"error": "Unable to verify authentication."}), 500

def get_profile():return jsonify({"user":g.current_user}),200
def patch_profile():
    try:
        name=update_own_profile(g.current_user["id"],(request.get_json(silent=True) or {}).get("full_name"));g.current_user["full_name"]=name
        return jsonify({"user":g.current_user}),200
    except ValueError as error:return jsonify({"error":{"code":"INVALID_PROFILE","message":str(error)}}),400
    except Exception:logger.exception("Profile update failed.");return jsonify({"error":{"code":"PROFILE_UPDATE_FAILED","message":"Profile could not be updated."}}),500

def account_token_controller(purpose,complete=False):
    try:
        data=request.get_json(silent=True) or {};token=data.get("token")
        result=complete_account_token(token,purpose,data) if complete else validate_account_token(token,purpose)
        response=jsonify(result);response.headers["Cache-Control"]="no-store";return response,200
    except (InvalidAccountToken,StaffValidationError) as error:
        fields=getattr(error,"fields",None);body={"error":{"code":"INVALID_ACCOUNT_LINK" if not fields else "INVALID_PASSWORD","message":"This link is invalid or has expired." if not fields else "Check the password fields."}}
        if fields:body["error"]["fields"]=fields
        return jsonify(body),400
    except Exception:logger.exception("Account token request failed.");return jsonify({"error":{"code":"ACCOUNT_REQUEST_FAILED","message":"The account request could not be completed."}}),500
