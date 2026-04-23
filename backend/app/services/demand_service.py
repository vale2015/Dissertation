from sqlalchemy import text
from app.db.dbcon import SessionLocal


def get_all_demand_records():
    with SessionLocal() as db:
        result = db.execute(text("""
            SELECT *
            FROM public.restaurant_demand_features
            ORDER BY date
        """))
        return [dict(r._mapping) for r in result]


def get_latest_demand_record():
    with SessionLocal() as db:
        result = db.execute(text("""
            SELECT
                date,
                same_day_covers,
                walk_in_covers,
                advance_covers,
                total_covers,
                avg_duration_covers_summary
            FROM public.restaurant_demand_features
            ORDER BY date DESC
            LIMIT 1
        """))
        row = result.fetchone()

    return dict(row._mapping) if row else None


def insert_demand_record(data):
    same_day_covers = data["same_day_covers"]
    walk_in_covers = data["walk_in_covers"]
    advance_covers = data["advance_covers"]
    avg_duration_min = data["avg_duration_min"]
    total_covers = same_day_covers + walk_in_covers + advance_covers

    with SessionLocal() as db:
        db.execute(text("""
            INSERT INTO public.restaurant_demand_features
            (
                date,
                same_day_covers,
                walk_in_covers,
                advance_covers,
                total_covers,
                avg_duration_covers_summary
            )
            VALUES
            (
                :date,
                :same_day_covers,
                :walk_in_covers,
                :advance_covers,
                :total_covers,
                :avg_duration_min
            )
        """), {
            "date": data["date"],
            "same_day_covers": same_day_covers,
            "walk_in_covers": walk_in_covers,
            "advance_covers": advance_covers,
            "total_covers": total_covers,
            "avg_duration_min": avg_duration_min
        })
        db.commit()

    return {
        "message": "Record inserted successfully",
        "total_covers": total_covers
    }


def get_demand_statistics():
    with SessionLocal() as db:
        result = db.execute(text("""
            SELECT
                COUNT(*) AS total_days,
                AVG(same_day_covers) AS avg_same_day_covers,
                AVG(walk_in_covers) AS avg_walk_in_covers,
                AVG(advance_covers) AS avg_advance_covers,
                AVG(total_covers) AS avg_total_covers,
                MAX(total_covers) AS max_total_covers,
                AVG(avg_duration_covers_summary) AS avg_duration_min
            FROM public.restaurant_demand_features
        """))
        row = result.fetchone()

    return dict(row._mapping) if row else {}


def get_demand_record_by_date(date):
    with SessionLocal() as db:
        result = db.execute(text("""
            SELECT *
            FROM public.restaurant_demand_features
            WHERE date = :date
        """), {"date": date})
        row = result.fetchone()

    return dict(row._mapping) if row else None


def delete_demand_record(date):
    with SessionLocal() as db:
        result = db.execute(text("""
            DELETE FROM public.restaurant_demand_features
            WHERE date = :date
        """), {"date": date})
        db.commit()

    return result.rowcount


def get_weekly_demand_summary():
    with SessionLocal() as db:
        result = db.execute(text("""
            SELECT
                date,
                total_covers
            FROM public.restaurant_demand_features
            ORDER BY date DESC
            LIMIT 7
        """))
        rows = [dict(r._mapping) for r in result]

    rows.reverse()

    def get_staff_from_covers(covers):
        covers = int(covers or 0)

        if covers <= 20:
            return 3
        if covers <= 30:
            return 4
        if covers <= 40:
            return 6
        return 8

    formatted_rows = []
    for row in rows:
        date_value = row.get("date")
        total_covers = float(row.get("total_covers") or 0)

        label = date_value.strftime("%a") if date_value else ""
        formatted_rows.append({
            "label": label,
            "date": str(date_value) if date_value else "",
            "value": round(total_covers),
            "staff": get_staff_from_covers(total_covers),
        })

    return formatted_rows