export const ROLES={MANAGER:"manager",SUPERVISOR:"supervisor",STAFF:"staff"};
export const PERMISSIONS={VIEW_DASHBOARD:"view_dashboard",MANAGE_BOOKINGS:"manage_bookings",VIEW_FORECASTS:"view_forecasts",VIEW_REPORTS:"view_reports",MANAGE_STAFFING_RULES:"manage_staffing_rules",MANAGE_STAFF_ACCOUNTS:"manage_staff_accounts",VIEW_OWN_PROFILE:"view_own_profile"};
export const hasRole=(user,...roles)=>Boolean(user&&roles.includes(user.role));
export const hasPermission=(user,permission)=>Boolean(user?.permissions?.includes(permission));
