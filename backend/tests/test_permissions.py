import pytest
from app.services.permission_service import *
def test_permission_matrix():
    assert has_permission({"role":ROLE_MANAGER},MANAGE_STAFF_ACCOUNTS)
    assert has_permission({"role":ROLE_SUPERVISOR},VIEW_REPORTS)
    assert not has_permission({"role":ROLE_SUPERVISOR},MANAGE_STAFFING_RULES)
    assert permissions_for_role(ROLE_STAFF)==[VIEW_OWN_PROFILE]
    assert not has_permission({"role":"Kitchen Assistant"},VIEW_OWN_PROFILE)
@pytest.mark.parametrize("value",["owner","Kitchen Assistant","",None])
def test_unknown_roles_fail_closed(value):
    with pytest.raises(ValueError):normalize_role(value)
