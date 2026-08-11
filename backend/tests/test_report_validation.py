import pytest
from app.services.report_validation_service import ReportValidationError,validate_report_parameters


def test_validation_defaults_and_supported_periods():
    assert validate_report_parameters("2026-08-11")["days_ahead"]==7
    assert validate_report_parameters("2026-08-11","10")["days_ahead"]==10


@pytest.mark.parametrize("date,days",[("11-08-2026","7"),("2026-08-11","8"),(None,"7")])
def test_validation_rejects_bad_parameters(date,days):
    with pytest.raises(ReportValidationError):validate_report_parameters(date,days)
