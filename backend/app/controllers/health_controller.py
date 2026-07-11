from flask import current_app, jsonify
from sqlalchemy import text

from app.db.dbcon import SessionLocal


# Return a simple response confirming that the backend API is running.
def health():
    return jsonify({
        "status": "ok",
        "message": "Backend service is running",
    }), 200


# Test the database connection by running a simple SQL query.
def database_health():
    try:
        with SessionLocal() as db:
            result = db.execute(text("SELECT 1")).scalar()

        return jsonify({
            "status": "ok",
            "database": "connected",
            "check": result,
        }), 200

    except Exception as error:
        # Write the complete traceback to Vercel Logs.
        # The API response exposes only the error type, not credentials.
        current_app.logger.exception(
            "Database health check failed: %s",
            error,
        )

        return jsonify({
            "status": "error",
            "message": "Database connection failed",
            "error_type": type(error).__name__,
        }), 500