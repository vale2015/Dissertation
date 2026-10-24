import { PERMISSIONS } from "./permissions.js";

const ROUTE_PERMISSIONS = {
  "/dashboard": PERMISSIONS.VIEW_DASHBOARD,
  "/dashboard/bookings": PERMISSIONS.MANAGE_BOOKINGS,
  "/dashboard/createBooking": PERMISSIONS.MANAGE_BOOKINGS,
  "/dashboard/local-events": PERMISSIONS.VIEW_FORECASTS,
  "/dashboard/reservation-forecast": PERMISSIONS.VIEW_FORECASTS,
  "/dashboard/staff-forecast": PERMISSIONS.VIEW_FORECASTS,
  "/dashboard/forecast-accuracy": PERMISSIONS.VIEW_FORECASTS,
  "/dashboard/staffing-rules": PERMISSIONS.MANAGE_STAFFING_RULES,
  "/dashboard/reports": PERMISSIONS.VIEW_REPORTS,
  "/dashboard/staff": PERMISSIONS.MANAGE_STAFF_ACCOUNTS,
  "/dashboard/profile": PERMISSIONS.VIEW_OWN_PROFILE,
};

export function dashboardPermission(pathname) {
  if (pathname === "/dashboard/reports/history" || pathname?.startsWith("/dashboard/reports/history/")) {
    return PERMISSIONS.VIEW_REPORTS;
  }
  return ROUTE_PERMISSIONS[pathname] || null;
}
