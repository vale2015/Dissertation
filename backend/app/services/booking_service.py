'''from sqlalchemy import text
from datetime import datetime,date, time
from app.db.dbcon import engine
import html
import re 


def sanitize_text(value, max_length=None):
    if value is None:
        return None

    value = str(value).strip()

    value = re.sub(r"[\x00-\x1f\x7f]", "", value)

    if max_length:
        value = value[:max_length]

    return html.escape(value, quote=True)


def serialize_booking_row(row_dict):
    serialized = {}

    for key, value in row_dict.items():
        if isinstance(value, (datetime, date, time)):
            serialized[key] = value.isoformat()
        else:
            serialized[key] = value

    return serialized

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
        


def fetch_booking_by_id_service(booking_id):
    query = text("""
        SELECT *
        FROM bookings
        WHERE id = :booking_id
    """)

    with engine.connect() as conn:
        result = conn.execute(query, {"booking_id": booking_id})
        row = result.fetchone()
        return serialize_booking_row(dict(row._mapping)) if row else None
        


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

    with engine.connect() as conn:
        result = conn.execute(query, {
            "booking_date": data["booking_date"],
            "booking_time": data.get("booking_time"),
            "party_size": data["party_size"],
            "booking_type": data["booking_type"],
            "customer_name": data.get("customer_name"),
            "notes": data.get("notes")
        })
        conn.commit()
        return serialize_booking_row(dict(result.fetchone()._mapping))

        


def ensure_demand_row_exists(booking_date):
    check_query = text("""
        SELECT date
        FROM restaurant_demand_features
        WHERE date = :booking_date
    """)

    with engine.connect() as conn:
        result = conn.execute(check_query, {"booking_date": booking_date})
        row = result.fetchone()

        if row:
            return

    dt = datetime.strptime(booking_date, "%Y-%m-%d")
    day_name = dt.strftime("%A")
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
            is_weekend,
            covers_lag_1,
            covers_lag_7,
            rolling_mean_3,
            rolling_mean_7,
            raw_avg_stay_duration,
            raw_unique_tables,
            raw_unique_areas,
            raw_promotion_count,
            channel_dish_cult_portal,
            channel_dish_cult_ios,
            channel_internal,
            channel_online,
            channel_resdiary_reserve_with_google
        )
        VALUES (
            :date,
            0, 0, 0, 0,
            0,
            0, 0, 0, 0,
            0,
            :day_of_week,
            :month,
            :week_of_year,
            :day_of_month,
            :is_weekend,
            0, 0, 0, 0,
            0,
            0, 0, 0,
            0, 0, 0, 0, 0
        )
    """)

    with engine.connect() as conn:
        conn.execute(insert_query, {
            "date": booking_date,
            "day_of_week": day_name,
            "month": month,
            "week_of_year": week_of_year,
            "day_of_month": day_of_month,
            "is_weekend": is_weekend
        })
        conn.commit()


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


def create_booking_and_sync_features(data):
    booking = insert_booking(data)
    rebuild_demand_features_for_date(data["booking_date"])
    return booking


def update_booking_and_sync_features(booking_id, data):
    existing_booking = fetch_booking_by_id_service(booking_id)

    if not existing_booking:
        return None

    old_booking_date = str(existing_booking["booking_date"])

    updated_data = {
        "booking_date": data.get("booking_date", str(existing_booking["booking_date"])),
        "booking_time": data.get("booking_time", existing_booking.get("booking_time")),
        "party_size": data.get("party_size", existing_booking["party_size"]),
        "booking_type": data.get("booking_type", existing_booking["booking_type"]),
        "customer_name": data.get("customer_name", existing_booking.get("customer_name")),
        "notes": data.get("notes", existing_booking.get("notes"))
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
    """)

    with engine.connect() as conn:
        conn.execute(update_query, {
            "booking_id": booking_id,
            "booking_date": updated_data["booking_date"],
            "booking_time": updated_data["booking_time"],
            "party_size": updated_data["party_size"],
            "booking_type": updated_data["booking_type"],
            "customer_name": updated_data["customer_name"],
            "notes": updated_data["notes"]
        })
        conn.commit()

    new_booking_date = str(updated_data["booking_date"])

    rebuild_demand_features_for_date(old_booking_date)

    if new_booking_date != old_booking_date:
        rebuild_demand_features_for_date(new_booking_date)

    return fetch_booking_by_id_service(booking_id)


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

    return True'''

from sqlalchemy import text
from datetime import datetime, date, time
from app.db.dbcon import engine
import html
import re


# Sanitises free-text input before saving it to the database.
# This helps reduce stored XSS risk by:
# 1. converting the value to a string
# 2. trimming extra spaces
# 3. removing control characters
# 4. limiting the maximum length
# 5. escaping HTML special characters such as < > " '
def sanitize_text(value, max_length=None):
    # If no value is provided, keep it as None.
    if value is None:
        return None

    # Convert the value to string and remove leading/trailing spaces.
    value = str(value).strip()

    # Remove non-printable control characters.
    value = re.sub(r"[\x00-\x1f\x7f]", "", value)

    # Apply a maximum length if one is provided.
    if max_length:
        value = value[:max_length]

    # Escape HTML characters to reduce XSS risk.
    return html.escape(value, quote=True)


# Converts database row values into JSON-friendly values.
# This is useful because datetime/date/time objects cannot be returned directly in JSON.
def serialize_booking_row(row_dict):
    # Create a new dictionary that will store the converted values.
    serialized = {}

    # Loop through every column/value pair in the row.
    for key, value in row_dict.items():
        # If the value is a datetime, date, or time object,
        # convert it to ISO format string.
        if isinstance(value, (datetime, date, time)):
            serialized[key] = value.isoformat()
        else:
            # Otherwise keep the value unchanged.
            serialized[key] = value

    # Return the serialised row.
    return serialized


# Fetches all bookings from the database.
def fetch_all_bookings_service():
    # SQL query to select all bookings ordered by:
    # 1. latest booking_date first
    # 2. latest booking_time first
    # 3. latest id first
    query = text("""
        SELECT *
        FROM bookings
        ORDER BY booking_date DESC, booking_time DESC NULLS LAST, id DESC
    """)

    # Open a database connection.
    with engine.connect() as conn:
        # Execute the query.
        result = conn.execute(query)

        # Fetch all returned rows.
        rows = result.fetchall()

        # Convert every row into a serialised dictionary and return the full list.
        return [serialize_booking_row(dict(row._mapping)) for row in rows]


# Fetches a single booking by its ID.
def fetch_booking_by_id_service(booking_id):
    # SQL query to find one booking by id.
    query = text("""
        SELECT *
        FROM bookings
        WHERE id = :booking_id
    """)

    # Open a database connection.
    with engine.connect() as conn:
        # Execute the query safely using parameter binding.
        result = conn.execute(query, {"booking_id": booking_id})

        # Get the first matching row.
        row = result.fetchone()

        # If a row exists, serialise and return it; otherwise return None.
        return serialize_booking_row(dict(row._mapping)) if row else None


# Inserts a new booking into the database.
def insert_booking(data):
    # SQL query to insert a new booking and immediately return the inserted row.
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

    # Prepare the cleaned and safe values before inserting them.
    booking_date = data["booking_date"]
    booking_time = data.get("booking_time")
    party_size = data["party_size"]
    booking_type = data["booking_type"]

    # Sanitize free-text fields to reduce XSS risk.
    customer_name = sanitize_text(data.get("customer_name"), max_length=100)
    notes = sanitize_text(data.get("notes"), max_length=500)

    # Open a database connection.
    with engine.connect() as conn:
        # Execute the insert query with safe bound parameters.
        result = conn.execute(query, {
            "booking_date": booking_date,
            "booking_time": booking_time,
            "party_size": party_size,
            "booking_type": booking_type,
            "customer_name": customer_name,
            "notes": notes
        })

        # Commit the transaction so the insert is saved.
        conn.commit()

        # Fetch the inserted row, serialise it, and return it.
        return serialize_booking_row(dict(result.fetchone()._mapping))


# Ensures that a row exists in restaurant_demand_features for a given booking date.
# If the row does not exist, it creates a default one.
def ensure_demand_row_exists(booking_date):
    # SQL query to check whether the row already exists.
    check_query = text("""
        SELECT date
        FROM restaurant_demand_features
        WHERE date = :booking_date
    """)

    # Open a database connection.
    with engine.connect() as conn:
        # Execute the existence check.
        result = conn.execute(check_query, {"booking_date": booking_date})

        # Get the first matching row.
        row = result.fetchone()

        # If the row already exists, nothing else is needed.
        if row:
            return

    # Convert the booking date string into a datetime object
    # so extra calendar values can be derived.
    dt = datetime.strptime(booking_date, "%Y-%m-%d")

    # Derive useful date-related fields.
    day_name = dt.strftime("%A")
    month = dt.month
    week_of_year = int(dt.strftime("%V"))
    day_of_month = dt.day
    is_weekend = 1 if dt.weekday() >= 5 else 0

    # SQL query to insert a default demand row for that date.
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
            is_weekend,
            covers_lag_1,
            covers_lag_7,
            rolling_mean_3,
            rolling_mean_7,
            raw_avg_stay_duration,
            raw_unique_tables,
            raw_unique_areas,
            raw_promotion_count,
            channel_dish_cult_portal,
            channel_dish_cult_ios,
            channel_internal,
            channel_online,
            channel_resdiary_reserve_with_google
        )
        VALUES (
            :date,
            0, 0, 0, 0,
            0,
            0, 0, 0, 0,
            0,
            :day_of_week,
            :month,
            :week_of_year,
            :day_of_month,
            :is_weekend,
            0, 0, 0, 0,
            0,
            0, 0, 0,
            0, 0, 0, 0, 0
        )
    """)

    # Open a new database connection.
    with engine.connect() as conn:
        # Insert the default row with derived date values.
        conn.execute(insert_query, {
            "date": booking_date,
            "day_of_week": day_name,
            "month": month,
            "week_of_year": week_of_year,
            "day_of_month": day_of_month,
            "is_weekend": is_weekend
        })

        # Commit the transaction.
        conn.commit()


# Rebuilds the aggregate demand features for a specific date
# based on the current bookings stored for that date.
def rebuild_demand_features_for_date(booking_date):
    # Make sure the demand row exists before updating it.
    ensure_demand_row_exists(booking_date)

    # SQL query to calculate booking aggregates for the selected date.
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

    # Open a database connection.
    with engine.connect() as conn:
        # Run the aggregate query for the selected date.
        result = conn.execute(aggregate_query, {"booking_date": booking_date})

        # Get the aggregated row.
        row = result.fetchone()

        # Read each aggregate safely, defaulting to 0 if missing.
        same_day_covers = row.same_day_covers or 0
        walk_in_covers = row.walk_in_covers or 0
        advance_covers = row.advance_covers or 0

        same_day_bookings = row.same_day_bookings or 0
        walk_in_bookings = row.walk_in_bookings or 0
        advance_bookings = row.advance_bookings or 0

        # Calculate totals.
        total_covers = same_day_covers + walk_in_covers + advance_covers
        total_bookings = same_day_bookings + walk_in_bookings + advance_bookings

        # SQL query to update the demand features row.
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

        # Execute the update query using the calculated values.
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

        # Commit the updated aggregates.
        conn.commit()


# Creates a booking and then updates the related demand features.
def create_booking_and_sync_features(data):
    # Insert the booking first.
    booking = insert_booking(data)

    # Recalculate aggregates for that booking date.
    rebuild_demand_features_for_date(data["booking_date"])

    # Return the inserted booking.
    return booking


# Updates an existing booking and synchronises the demand features table.
def update_booking_and_sync_features(booking_id, data):
    # Fetch the existing booking from the database.
    existing_booking = fetch_booking_by_id_service(booking_id)

    # If no booking exists for that ID, return None.
    if not existing_booking:
        return None

    # Store the old booking date so the old day's aggregates can be rebuilt.
    old_booking_date = str(existing_booking["booking_date"])

    # Build the updated data object.
    # If a new value is missing, fall back to the current value.
    updated_data = {
        "booking_date": data.get("booking_date", str(existing_booking["booking_date"])),
        "booking_time": data.get("booking_time", existing_booking.get("booking_time")),
        "party_size": data.get("party_size", existing_booking["party_size"]),
        "booking_type": data.get("booking_type", existing_booking["booking_type"]),

        # Sanitize free-text fields before saving.
        "customer_name": sanitize_text(
            data.get("customer_name", existing_booking.get("customer_name")),
            max_length=100
        ),
        "notes": sanitize_text(
            data.get("notes", existing_booking.get("notes")),
            max_length=500
        )
    }

    # SQL query to update the booking.
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
    """)

    # Open a database connection.
    with engine.connect() as conn:
        # Execute the update query with the prepared values.
        conn.execute(update_query, {
            "booking_id": booking_id,
            "booking_date": updated_data["booking_date"],
            "booking_time": updated_data["booking_time"],
            "party_size": updated_data["party_size"],
            "booking_type": updated_data["booking_type"],
            "customer_name": updated_data["customer_name"],
            "notes": updated_data["notes"]
        })

        # Commit the update.
        conn.commit()

    # Store the new booking date after the update.
    new_booking_date = str(updated_data["booking_date"])

    # Rebuild aggregates for the old booking date.
    rebuild_demand_features_for_date(old_booking_date)

    # If the booking date changed, also rebuild aggregates for the new date.
    if new_booking_date != old_booking_date:
        rebuild_demand_features_for_date(new_booking_date)

    # Return the freshly updated booking from the database.
    return fetch_booking_by_id_service(booking_id)


# Deletes a booking and updates the demand features for that date.
def delete_booking_and_sync_features(booking_id):
    # Fetch the booking first to confirm it exists.
    existing_booking = fetch_booking_by_id_service(booking_id)

    # If no booking exists, return False.
    if not existing_booking:
        return False

    # Store the booking date before deletion so aggregates can be recalculated.
    booking_date = str(existing_booking["booking_date"])

    # SQL query to delete the booking.
    delete_query = text("""
        DELETE FROM bookings
        WHERE id = :booking_id
    """)

    # Open a database connection.
    with engine.connect() as conn:
        # Execute the delete query safely with parameter binding.
        conn.execute(delete_query, {"booking_id": booking_id})

        # Commit the deletion.
        conn.commit()

    # Rebuild demand aggregates for the deleted booking's date.
    rebuild_demand_features_for_date(booking_date)

    # Return True to indicate successful deletion.
    return True