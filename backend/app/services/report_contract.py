"""Canonical management-report contract (version 1.0).

All preview and export consumers receive this JSON-serialisable structure.
Unknown scalar values use ``None``; unavailable optional context uses an
``available: False`` object; collections default to empty lists. Currency
figures are numbers rounded to two decimals. No presentation objects or PII
belong in this contract.
"""

CONTRACT_VERSION = "1.0"


def empty_management_report():
    return {
        "contract_version": CONTRACT_VERSION,
        "metadata": {
            "report_type": "management_forecast",
            "selected_date": None, "start_date": None, "end_date": None,
            "days_ahead": 7, "generated_at": None,
            "restaurant_name": None, "restaurant_city": None,
            "currency": "GBP",
        },
        "summary": {
            "forecasted_covers": 0, "open_days": 0, "closed_days": 0,
            "average_daily_covers": None, "peak_date": None,
            "peak_covers": None, "quietest_open_date": None,
            "quietest_open_day_covers": None,
            "total_staff_assignments": 0,
        },
        "financials": {
            "average_spend_per_cover": None,
            "food_cost_percentage": None, "estimated_revenue": None,
            "estimated_food_cost": None,
            "estimated_gross_profit_before_labour": None,
            "estimated_labour_cost": 0.0,
            "estimated_contribution_after_food_and_labour": None,
            "labour_to_revenue_percentage": None,
        },
        "booking_mix_reference": {
            "title": "Historical booking mix reference",
            "same_day_average": None, "walk_in_average": None,
            "advance_booking_average": None,
            "average_booking_duration": None,
            "reference_window": "7-day rolling model inputs",
        },
        "daily_breakdown": [], "operational_insights": [], "warnings": [],
        "data_sources": {
            key: {"available": False, "message": "Not loaded."}
            for key in ("demand", "staffing", "business_settings", "weather", "events")
        },
    }
