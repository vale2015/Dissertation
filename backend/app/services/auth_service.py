import os
from datetime import datetime, timedelta, timezone

import jwt
from sqlalchemy import text
from werkzeug.security import check_password_hash

from app.db.dbcon import SessionLocal


TOKEN_DURATION_HOURS = 8
TOKEN_ISSUER = "rfs-backend"


# Return the JWT signing key from the backend environment.
def get_secret_key():
    secret_key = os.getenv("SECRET_KEY")

    if not secret_key:
        raise RuntimeError("JWT signing key is not configured")

    return secret_key


# Create a short-lived JWT for an authenticated user.
def create_token(user):
    now = datetime.now(timezone.utc)

    payload = {
        # JWT subject values should be strings.
        "sub": str(user["id"]),
        "iat": now,
        "exp": now + timedelta(hours=TOKEN_DURATION_HOURS),
        "iss": TOKEN_ISSUER,
    }

    return jwt.encode(
        payload,
        get_secret_key(),
        algorithm="HS256",
    )


# Check the supplied email and password.
def authenticate_user(email, password):
    normalized_email = str(email).strip().lower()

    with SessionLocal() as db:
        result = db.execute(
            text(
                """
                SELECT
                    id,
                    full_name,
                    email,
                    password_hash,
                    role
                FROM public.users
                WHERE LOWER(email) = :email
                LIMIT 1
                """
            ),
            {"email": normalized_email},
        )

        row = result.fetchone()

    # Use the same result for an unknown email or incorrect password.
    if not row:
        return None

    user = dict(row._mapping)

    if not check_password_hash(user["password_hash"], password):
        return None

    token = create_token(user)

    return {
        "message": "Login successful",
        "token": token,
        "user": {
            "id": user["id"],
            "full_name": user["full_name"],
            "email": user["email"],
            "role": user["role"],
        },
    }


# Decode the JWT and retrieve the latest user details from the database.
def decode_user_token(token):
    payload = jwt.decode(
        token,
        get_secret_key(),
        algorithms=["HS256"],
        issuer=TOKEN_ISSUER,
        options={
            "require": ["sub", "iat", "exp", "iss"],
        },
    )

    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        raise jwt.InvalidTokenError("Invalid user identifier")

    with SessionLocal() as db:
        result = db.execute(
            text(
                """
                SELECT
                    id,
                    full_name,
                    email,
                    role
                FROM public.users
                WHERE id = :user_id
                LIMIT 1
                """
            ),
            {"user_id": user_id},
        )

        row = result.fetchone()

    if not row:
        raise jwt.InvalidTokenError("Authenticated user no longer exists")

    user = dict(row._mapping)

    return {
        "message": "Authenticated user",
        "user": {
            "id": user["id"],
            "full_name": user["full_name"],
            "email": user["email"],
            "role": user["role"],
        },
    }