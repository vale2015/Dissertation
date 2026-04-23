import os
import jwt
from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from werkzeug.security import check_password_hash

from app.db.dbcon import SessionLocal


def create_token(user):
    payload = {
        "user_id": user["id"],
        "email": user["email"],
        "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=8)
    }

    return jwt.encode(payload, os.getenv("SECRET_KEY"), algorithm="HS256")


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


def decode_user_token(token):
    payload = jwt.decode(token, os.getenv("SECRET_KEY"), algorithms=["HS256"])

    return {
        "message": "Authenticated user",
        "user": {
            "user_id": payload["user_id"],
            "email": payload["email"],
            "role": payload["role"]
        }
    }