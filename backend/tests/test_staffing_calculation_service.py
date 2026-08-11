from app.services.staffing_calculation_service import calculate_staffing


def test_pure_staffing_handles_closed_and_missing_configuration():
    forecast=[{"date":"2026-08-12","predicted_total_covers":20,"closed":True},{"date":"2026-08-13","predicted_total_covers":200,"closed":False}]
    result=calculate_staffing(forecast,[],{})
    assert result[0]["estimated_labour_cost"]==0
    assert result[1]["warnings"][0]["code"]=="STAFFING_RULE_MISSING"
