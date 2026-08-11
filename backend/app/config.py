"""Application configuration values that are safe to expose in reports."""

import os


def get_report_configuration():
    """Return deployment-overridable, non-secret report metadata."""

    return {
        "currency": os.getenv("REPORT_CURRENCY", "GBP").strip() or "GBP",
        "restaurant_name": os.getenv(
            "REPORT_RESTAURANT_NAME",
            os.getenv("RESTAURANT_NAME", "Rosmarino Restaurant"),
        ).strip(),
        "restaurant_city": os.getenv(
            "REPORT_RESTAURANT_CITY",
            os.getenv("RESTAURANT_CITY", "London"),
        ).strip(),
    }
