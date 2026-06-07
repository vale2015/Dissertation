import os
import jwt
from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from werkzeug.security import check_password_hash

from app.db.dbcon import SessionLocal

# Creates a JWT token containing the user's basic details and expiry time.
def create_token(user):
    # Store user information inside the token payload.
    payload = {
        "user_id": user["id"],
        "email": user["email"],
        "role": user["role"],
        # Token expires after 8 hours.
        "exp": datetime.now(timezone.utc) + timedelta(hours=8)
    }

    # Encode the payload using the secret key from the .env file.
    return jwt.encode(payload, os.getenv("SECRET_KEY"), algorithm="HS256")

# Checks the user's email and password during login.
def authenticate_user(email, password):
    with SessionLocal() as db:
        result = db.execute(text("""
            SELECT id, full_name, email, password_hash, role
            FROM public.users
            WHERE email = :email
            LIMIT 1
        """), {"email": email})

        row = result.fetchone()

    if not row:
        return None

    user = dict(row._mapping)

    if not check_password_hash(user["password_hash"], password):
        return None
    # Create a JWT token after successful authentication.
    token = create_token(user)

    return {
        "message": "Login successful",
        "token": token,
        "user": {
            "id": user["id"],
            "full_name": user["full_name"],
            "email": user["email"],
            "role": user["role"]
        }
    }

# Decodes the JWT token to retrieve the authenticated user's details.
def decode_user_token(token):
    # Validate and decode the token using the secret key.
    payload = jwt.decode(token, os.getenv("SECRET_KEY"), algorithms=["HS256"])
    # Return the authenticated user's details from the token payload.
    return {
        "message": "Authenticated user",
        "user": {
            "user_id": payload["user_id"],
            "email": payload["email"],
            "role": payload["role"]
        }
    }