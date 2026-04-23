from flask import jsonify
from sqlalchemy import text
from app.db.dbcon import SessionLocal


def health():
    return jsonify({"status": "ok"}), 200


def health_db():
    try:
        with SessionLocal() as db:
            result = db.execute(text("SELECT 1")).scalar()

        return jsonify({
            "db": "ok",
            "select_1": result
        }), 200

    except Exception as e:
        return jsonify({
            "db": "error",
            "message": str(e)
        }), 500


def get_columns():
    try:
        with SessionLocal() as db:
            result = db.execute(text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'restaurant_demand_features'
                ORDER BY ordinal_position
            """))

            columns = [row[0] for row in result.fetchall()]

        return jsonify({
            "table": "restaurant_demand_features",
            "columns": columns
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500