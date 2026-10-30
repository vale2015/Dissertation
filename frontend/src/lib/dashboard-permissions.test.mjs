import assert from "node:assert/strict";
import test from "node:test";

import { dashboardPermission } from "./dashboard-permissions.js";
import { hasPermission, PERMISSIONS } from "./permissions.js";

test("dashboard routes keep their page permissions", () => {
  const routes = new Map([
    ["/dashboard", PERMISSIONS.VIEW_DASHBOARD],
    ["/dashboard/bookings", PERMISSIONS.MANAGE_BOOKINGS],
    ["/dashboard/createBooking", PERMISSIONS.MANAGE_BOOKINGS],
    ["/dashboard/local-events", PERMISSIONS.VIEW_FORECASTS],
    ["/dashboard/reservation-forecast", PERMISSIONS.VIEW_FORECASTS],
    ["/dashboard/staff-forecast", PERMISSIONS.VIEW_FORECASTS],
    ["/dashboard/forecast-accuracy", PERMISSIONS.VIEW_FORECASTS],
    ["/dashboard/staffing-rules", PERMISSIONS.MANAGE_STAFFING_RULES],
    ["/dashboard/reports", PERMISSIONS.VIEW_REPORTS],
    ["/dashboard/reports/history", PERMISSIONS.VIEW_REPORTS],
    ["/dashboard/reports/history/1", PERMISSIONS.VIEW_REPORTS],
    ["/dashboard/staff", PERMISSIONS.MANAGE_STAFF_ACCOUNTS],
    ["/dashboard/profile", PERMISSIONS.VIEW_OWN_PROFILE],
    ["/dashboard/settings", PERMISSIONS.VIEW_OWN_PROFILE],
  ]);

  for (const [path, permission] of routes) {
    assert.equal(dashboardPermission(path), permission, path);
  }
});

test("saved-report details deny a user without report access", () => {
  const permission = dashboardPermission("/dashboard/reports/history/1");
  assert.equal(hasPermission({ permissions: [PERMISSIONS.VIEW_OWN_PROFILE] }, permission), false);
  assert.equal(hasPermission({ permissions: [PERMISSIONS.VIEW_REPORTS] }, permission), true);
});
