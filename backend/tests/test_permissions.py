import pytest
from app.services.permission_service import *
def test_permission_matrix():
    assert has_permission({"role":ROLE_MANAGER},MANAGE_STAFF_ACCOUNTS)
    assert has_permission({"role":ROLE_SUPERVISOR},VIEW_REPORTS)
    assert not has_permission({"role":ROLE_SUPERVISOR},MANAGE_STAFFING_RULES)
    assert permissions_for_role(ROLE_STAFF)==[VIEW_OWN_PROFILE]
    assert not has_permission({"role":"Kitchen Assistant"},VIEW_OWN_PROFILE)
def test_manage_demand_is_manager_only():
    assert MANAGE_DEMAND=="manage_demand"
    assert has_permission({"role":ROLE_MANAGER},MANAGE_DEMAND)
    assert not has_permission({"role":ROLE_SUPERVISOR},MANAGE_DEMAND)
    assert not has_permission({"role":ROLE_STAFF},MANAGE_DEMAND)
    assert MANAGE_DEMAND in permissions_for_role(ROLE_MANAGER)
    assert permissions_for_role(ROLE_MANAGER)==sorted([VIEW_DASHBOARD,MANAGE_BOOKINGS,VIEW_FORECASTS,VIEW_REPORTS,MANAGE_STAFFING_RULES,MANAGE_STAFF_ACCOUNTS,VIEW_OWN_PROFILE,MANAGE_DEMAND])
    assert permissions_for_role(ROLE_SUPERVISOR)==sorted([VIEW_DASHBOARD,MANAGE_BOOKINGS,VIEW_FORECASTS,VIEW_REPORTS,VIEW_OWN_PROFILE])
def test_frontend_permission_constants_match_backend():
    import pathlib,re
    source=(pathlib.Path(__file__).resolve().parents[2]/"frontend"/"src"/"lib"/"permissions.js").read_text(encoding="utf-8")
    block=re.search(r"PERMISSIONS=\{(.*?)\}",source).group(1)
    frontend=set(re.findall(r':"([a-z_]+)"',block))
    backend=set().union(*ROLE_PERMISSIONS.values())
    assert frontend==backend
@pytest.mark.parametrize("value",["owner","Kitchen Assistant","",None])
def test_unknown_roles_fail_closed(value):
    with pytest.raises(ValueError):normalize_role(value)
