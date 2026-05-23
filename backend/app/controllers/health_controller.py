from flask import jsonify
from sqlalchemy import text
from app.db.dbcon import SessionLocal


def health():
    return jsonify({
        "status": "ok",
        "message": "Backend service is running"
    }), 200


def database_health():
    try:
        with SessionLocal() as db:
            result = db.execute(text("SELECT 1")).scalar()

        return jsonify({
            "status": "ok",
            "database": "connected",
            "check": result
        }), 200

    except Exception:
        return jsonify({
            "status": "error",
            "message": "Database connection failed"
        }), 500