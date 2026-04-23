'''from sqlalchemy import text
from app.db.dbcon import SessionLocal


def get_dashboard_summary():
    with SessionLocal() as db:
        stats = db.execute(text("""
            SELECT
                COUNT(*) AS total_days,
                AVG(same_day_covers) AS avg_same_day_covers,
                AVG(walk_in_covers) AS avg_walk_in_covers,
                AVG(advance_covers) AS avg_advance_covers,
                AVG(total_covers) AS avg_total_covers,
                MAX(total_covers) AS max_total_covers,
                AVG(avg_duration_covers_summary) AS avg_duration_covers_summary
            FROM public.restaurant_demand_features
        """)).fetchone()

        latest = db.execute(text("""
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
        """)).fetchone()

        return {
            "summary": dict(stats._mapping) if stats else {},
            "latest_record": dict(latest._mapping) if latest else {}
        }'''

from sqlalchemy import text
from app.db.dbcon import SessionLocal


def get_dashboard_summary():
    with SessionLocal() as db:
        stats = db.execute(
            text("""
                SELECT
                    COUNT(*) AS total_days,
                    AVG(same_day_covers) AS avg_same_day_covers,
                    AVG(walk_in_covers) AS avg_walk_in_covers,
                    AVG(advance_covers) AS avg_advance_covers,
                    AVG(total_covers) AS avg_total_covers,
                    MAX(total_covers) AS max_total_covers,
                    AVG(avg_duration_covers_summary) AS avg_duration_covers_summary,
                    SUM(total_covers) AS total_covers_30_days
                FROM public.restaurant_demand_features
                WHERE date >= CURRENT_DATE - INTERVAL '30 days'
            """)
        ).fetchone()

        latest = db.execute(
            text("""
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
            """)
        ).fetchone()

        business_settings = db.execute(
            text("""
                SELECT
                    average_spend_per_cover,
                    food_cost_percentage
                FROM public.business_settings
                ORDER BY id DESC
                LIMIT 1
            """)
        ).fetchone()

        labour_stats = db.execute(
            text("""
                SELECT
                    SUM(estimated_cost) AS total_labour_cost
                FROM public.staff_cost_forecast
            """)
        ).fetchone()

        highest_labour_day_record = db.execute(
            text("""
                SELECT
                    forecast_date,
                    SUM(estimated_cost) AS total_day_labour_cost
                FROM public.staff_cost_forecast
                GROUP BY forecast_date
                ORDER BY total_day_labour_cost DESC
                LIMIT 1
            """)
        ).fetchone()

        summary = dict(stats._mapping) if stats else {}
        latest_record = dict(latest._mapping) if latest else {}
        settings = dict(business_settings._mapping) if business_settings else {}
        labour = dict(labour_stats._mapping) if labour_stats else {}
        highest_labour_day = (
            dict(highest_labour_day_record._mapping)
            if highest_labour_day_record
            else {}
        )

        total_covers = float(summary.get("total_covers_30_days") or 0)
        average_spend_per_cover = float(settings.get("average_spend_per_cover") or 0)
        food_cost_percentage = float(settings.get("food_cost_percentage") or 0)
        total_labour_cost = float(labour.get("total_labour_cost") or 0)
        highest_labour_cost_day = float(
            highest_labour_day.get("total_day_labour_cost") or 0
        )
        highest_labour_cost_date = highest_labour_day.get("forecast_date")

        estimated_food_revenue = round(total_covers * average_spend_per_cover, 2)
        estimated_food_cost = round(
            estimated_food_revenue * (food_cost_percentage / 100),
            2
        )
        gross_margin_after_labour = round(
            estimated_food_revenue - total_labour_cost,
            2
        )
        revenue_vs_labour_ratio = round(
            estimated_food_revenue / total_labour_cost,
            2
        ) if total_labour_cost > 0 else 0

        financial_summary = {
            "average_spend_per_cover": average_spend_per_cover,
            "food_cost_percentage": food_cost_percentage,
            "estimated_food_revenue": estimated_food_revenue,
            "estimated_food_cost": estimated_food_cost,
            "total_labour_cost": total_labour_cost,
            "gross_margin_after_labour": gross_margin_after_labour,
            "revenue_vs_labour_ratio": revenue_vs_labour_ratio,
            "highest_labour_cost_day": highest_labour_cost_day,
            "highest_labour_cost_date": highest_labour_cost_date,
        }

        return {
            "summary": summary,
            "latest_record": latest_record,
            "financial_summary": financial_summary,
        }