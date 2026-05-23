from sqlalchemy import text
from datetime import datetime, date, time
from app.db.dbcon import engine
import html
import re


# Sanitises free-text input before saving it to the database.
def sanitize_text(value, max_length=None):
    if value is None:
        return None

    value = str(value).strip()
    value = re.sub(r"[\x00-\x1f\x7f]", "", value)

    if max_length:
        value = value[:max_length]

    return html.escape(value, quote=True)


# Converts database values into JSON-friendly values.
def serialize_booking_row(row_dict):
    serialized = {}

    for key, value in row_dict.items():
        if isinstance(value, (datetime, date, time)):
            serialized[key] = value.isoformat()
        else:
            serialized[key] = value

    return serialized


# Makes sure booking_type always matches the database format.
def normalize_booking_type(value):
    if value is None:
        return None

    value = str(value).strip().lower()

    mapping = {
        "advance": "advance",
        "same_day": "same_day",
        "same-day": "same_day",
        "walk_in": "walk_in",
        "walk-in": "walk_in",
    }

    return mapping.get(value, value)


# Fetches all bookings.
def fetch_all_bookings_service():
    query = text("""
        SELECT *
        FROM bookings
        ORDER BY booking_date DESC, booking_time DESC NULLS LAST, id DESC
    """)

    with engine.connect() as conn:
        result = conn.execute(query)
        rows = result.fetchall()

        return [serialize_booking_row(dict(row._mapping)) for row in rows]


# Fetches one booking by ID.
def fetch_booking_by_id_service(booking_id):
    query = text("""
        SELECT *
        FROM bookings
        WHERE id = :booking_id
    """)

    with engine.connect() as conn:
        result = conn.execute(query, {"booking_id": booking_id})
        row = result.fetchone()

        if not row:
            return None

        return serialize_booking_row(dict(row._mapping))


# Inserts a booking into the bookings table.
def insert_booking(data):
    query = text("""
        INSERT INTO bookings (
            booking_date,
            booking_time,
            party_size,
            booking_type,
            customer_name,
            notes
        )
        VALUES (
            :booking_date,
            :booking_time,
            :party_size,
            :booking_type,
            :customer_name,
            :notes
        )
        RETURNING *
    """)

    booking_date = data["booking_date"]
    booking_time = data.get("booking_time")
    party_size = int(data["party_size"])
    booking_type = normalize_booking_type(data["booking_type"])
    customer_name = sanitize_text(data.get("customer_name"), max_length=100)
    notes = sanitize_text(data.get("notes"), max_length=500)

    with engine.connect() as conn:
        result = conn.execute(query, {
            "booking_date": booking_date,
            "booking_time": booking_time,
            "party_size": party_size,
            "booking_type": booking_type,
            "customer_name": customer_name,
            "notes": notes
        })

        inserted_row = result.fetchone()
        conn.commit()

        return serialize_booking_row(dict(inserted_row._mapping))


# Ensures that restaurant_demand_features has a row for the booking date.
def ensure_demand_row_exists(booking_date):
    check_query = text("""
        SELECT date
        FROM restaurant_demand_features
        WHERE date = :booking_date
    """)

    with engine.connect() as conn:
        result = conn.execute(check_query, {"booking_date": booking_date})
        existing_row = result.fetchone()

        if existing_row:
            return

    dt = datetime.strptime(str(booking_date), "%Y-%m-%d")

    day_of_week = dt.weekday()
    month = dt.month
    week_of_year = int(dt.strftime("%V"))
    day_of_month = dt.day
    is_weekend = 1 if dt.weekday() >= 5 else 0

    insert_query = text("""
        INSERT INTO restaurant_demand_features (
            date,
            same_day_covers,
            walk_in_covers,
            advance_covers,
            total_covers,
            avg_duration_covers_summary,
            advance_bookings,
            same_day_bookings,
            walk_in_bookings,
            total_bookings,
            avg_duration_bookings_summary,
            day_of_week,
            month,
            week_of_year,
            day_of_month,
            is_weekend
        )
        VALUES (
            :date,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            :day_of_week,
            :month,
            :week_of_year,
            :day_of_month,
            :is_weekend
        )
    """)

    with engine.connect() as conn:
        conn.execute(insert_query, {
            "date": booking_date,
            "day_of_week": day_of_week,
            "month": month,
            "week_of_year": week_of_year,
            "day_of_month": day_of_month,
            "is_weekend": is_weekend
        })

        conn.commit()


# Rebuilds the demand feature totals for one date.
def rebuild_demand_features_for_date(booking_date):
    ensure_demand_row_exists(booking_date)

    aggregate_query = text("""
        SELECT
            COALESCE(SUM(CASE WHEN booking_type = 'same_day' THEN party_size ELSE 0 END), 0) AS same_day_covers,
            COALESCE(SUM(CASE WHEN booking_type = 'walk_in' THEN party_size ELSE 0 END), 0) AS walk_in_covers,
            COALESCE(SUM(CASE WHEN booking_type = 'advance' THEN party_size ELSE 0 END), 0) AS advance_covers,

            COALESCE(SUM(CASE WHEN booking_type = 'same_day' THEN 1 ELSE 0 END), 0) AS same_day_bookings,
            COALESCE(SUM(CASE WHEN booking_type = 'walk_in' THEN 1 ELSE 0 END), 0) AS walk_in_bookings,
            COALESCE(SUM(CASE WHEN booking_type = 'advance' THEN 1 ELSE 0 END), 0) AS advance_bookings

        FROM bookings
        WHERE booking_date = :booking_date
    """)

    update_query = text("""
        UPDATE restaurant_demand_features
        SET
            same_day_covers = :same_day_covers,
            walk_in_covers = :walk_in_covers,
            advance_covers = :advance_covers,
            total_covers = :total_covers,
            same_day_bookings = :same_day_bookings,
            walk_in_bookings = :walk_in_bookings,
            advance_bookings = :advance_bookings,
            total_bookings = :total_bookings
        WHERE date = :booking_date
    """)

    with engine.connect() as conn:
        result = conn.execute(aggregate_query, {"booking_date": booking_date})
        row = result.fetchone()

        same_day_covers = row.same_day_covers or 0
        walk_in_covers = row.walk_in_covers or 0
        advance_covers = row.advance_covers or 0

        same_day_bookings = row.same_day_bookings or 0
        walk_in_bookings = row.walk_in_bookings or 0
        advance_bookings = row.advance_bookings or 0

        total_covers = same_day_covers + walk_in_covers + advance_covers
        total_bookings = same_day_bookings + walk_in_bookings + advance_bookings

        conn.execute(update_query, {
            "same_day_covers": same_day_covers,
            "walk_in_covers": walk_in_covers,
            "advance_covers": advance_covers,
            "total_covers": total_covers,
            "same_day_bookings": same_day_bookings,
            "walk_in_bookings": walk_in_bookings,
            "advance_bookings": advance_bookings,
            "total_bookings": total_bookings,
            "booking_date": booking_date
        })

        conn.commit()


# Creates a booking and syncs the forecasting dataset.
def create_booking_and_sync_features(data):
    booking = insert_booking(data)
    rebuild_demand_features_for_date(data["booking_date"])

    return booking


# Updates an existing booking and syncs the forecasting dataset.
def update_booking_and_sync_features(booking_id, data):
    existing_booking = fetch_booking_by_id_service(booking_id)

    if not existing_booking:
        return None

    old_booking_date = str(existing_booking["booking_date"])

    updated_data = {
        "booking_date": data.get("booking_date", str(existing_booking["booking_date"])),
        "booking_time": data.get("booking_time", existing_booking.get("booking_time")),
        "party_size": int(data.get("party_size", existing_booking["party_size"])),
        "booking_type": normalize_booking_type(
            data.get("booking_type", existing_booking["booking_type"])
        ),
        "customer_name": sanitize_text(
            data.get("customer_name", existing_booking.get("customer_name")),
            max_length=100
        ),
        "notes": sanitize_text(
            data.get("notes", existing_booking.get("notes")),
            max_length=500
        )
    }

    update_query = text("""
        UPDATE bookings
        SET
            booking_date = :booking_date,
            booking_time = :booking_time,
            party_size = :party_size,
            booking_type = :booking_type,
            customer_name = :customer_name,
            notes = :notes
        WHERE id = :booking_id
        RETURNING *
    """)

    with engine.connect() as conn:
        result = conn.execute(update_query, {
            "booking_id": booking_id,
            "booking_date": updated_data["booking_date"],
            "booking_time": updated_data["booking_time"],
            "party_size": updated_data["party_size"],
            "booking_type": updated_data["booking_type"],
            "customer_name": updated_data["customer_name"],
            "notes": updated_data["notes"]
        })

        updated_row = result.fetchone()
        conn.commit()

    new_booking_date = str(updated_data["booking_date"])

    rebuild_demand_features_for_date(old_booking_date)

    if new_booking_date != old_booking_date:
        rebuild_demand_features_for_date(new_booking_date)

    return serialize_booking_row(dict(updated_row._mapping))


# Deletes a booking and syncs the forecasting dataset.
def delete_booking_and_sync_features(booking_id):
    existing_booking = fetch_booking_by_id_service(booking_id)

    if not existing_booking:
        return False

    booking_date = str(existing_booking["booking_date"])

    delete_query = text("""
        DELETE FROM bookings
        WHERE id = :booking_id
    """)

    with engine.connect() as conn:
        conn.execute(delete_query, {"booking_id": booking_id})
        conn.commit()

    rebuild_demand_features_for_date(booking_date)

    return True

