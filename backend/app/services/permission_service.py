"""Authoritative application roles and permissions."""

ROLE_MANAGER="manager"; ROLE_SUPERVISOR="supervisor"; ROLE_STAFF="staff"
APPLICATION_ROLES=(ROLE_MANAGER,ROLE_SUPERVISOR,ROLE_STAFF)
STATUS_INVITED="invited"; STATUS_ACTIVE="active"; STATUS_SUSPENDED="suspended"; STATUS_INACTIVE="inactive"
ACCOUNT_STATUSES=(STATUS_INVITED,STATUS_ACTIVE,STATUS_SUSPENDED,STATUS_INACTIVE)
VIEW_DASHBOARD="view_dashboard"; MANAGE_BOOKINGS="manage_bookings"; VIEW_FORECASTS="view_forecasts"; VIEW_REPORTS="view_reports"
MANAGE_STAFFING_RULES="manage_staffing_rules"; MANAGE_STAFF_ACCOUNTS="manage_staff_accounts"; VIEW_OWN_PROFILE="view_own_profile"
ROLE_PERMISSIONS={
    ROLE_MANAGER:{VIEW_DASHBOARD,MANAGE_BOOKINGS,VIEW_FORECASTS,VIEW_REPORTS,MANAGE_STAFFING_RULES,MANAGE_STAFF_ACCOUNTS,VIEW_OWN_PROFILE},
    ROLE_SUPERVISOR:{VIEW_DASHBOARD,MANAGE_BOOKINGS,VIEW_FORECASTS,VIEW_REPORTS,VIEW_OWN_PROFILE},
    ROLE_STAFF:{VIEW_OWN_PROFILE},
}
def normalize_role(value):
    value=str(value or "").strip().lower()
    if value not in APPLICATION_ROLES: raise ValueError("Unsupported application role.")
    return value
def normalize_status(value):
    value=str(value or "").strip().lower()
    if value not in ACCOUNT_STATUSES: raise ValueError("Unsupported account status.")
    return value
def permissions_for_role(role): return sorted(ROLE_PERMISSIONS.get(str(role or "").lower(),set()))
def has_role(user,*roles): return bool(user) and user.get("role") in roles
def has_permission(user,permission): return permission in ROLE_PERMISSIONS.get((user or {}).get("role"),set())
