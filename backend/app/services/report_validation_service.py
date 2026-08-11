"""Shared request validation for every management-report representation."""

from datetime import datetime


class ReportValidationError(ValueError):
    def __init__(self, fields):
        super().__init__("Invalid report parameters.")
        self.fields = fields


def validate_report_parameters(selected_date, days_ahead=None):
    fields = {}
    if not selected_date:
        fields["selected_date"] = "A date in YYYY-MM-DD format is required."
    else:
        try:
            parsed = datetime.strptime(selected_date, "%Y-%m-%d").date()
            if parsed.isoformat() != selected_date:
                raise ValueError
        except (TypeError, ValueError):
            fields["selected_date"] = "Must use YYYY-MM-DD format."
    try:
        days = 7 if days_ahead in (None, "") else int(days_ahead)
    except (TypeError, ValueError):
        days = None
    if days not in (7, 10):
        fields["days_ahead"] = "Must be either 7 or 10."
    if fields:
        raise ReportValidationError(fields)
    return {"selected_date": selected_date, "days_ahead": days}
