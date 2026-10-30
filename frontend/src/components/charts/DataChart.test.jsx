import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, test } from "vitest";
import BookingsTrend from "./BookingsTrend";
import StaffingOverviewChart from "./StaffingOverviewChart";

afterEach(cleanup);

test("forecast chart exposes real values, axes, and a keyboard-readable table", () => {
  render(<BookingsTrend title="Reservation forecast" variant="columns" data={[
    { date: "2026-10-30", value: 24 },
    { date: "2026-10-31", value: 0 },
    { date: "2026-11-01", value: null },
  ]} />);
  expect(screen.getByRole("img", { name: /Reservation forecast/ })).toBeInTheDocument();
  const table = screen.getByRole("table", { name: "Reservation forecast" });
  expect(within(table).getByText("2026-10-30")).toBeInTheDocument();
  expect(within(table).getByText("24")).toBeInTheDocument();
  expect(within(table).getByText("0")).toBeInTheDocument();
  expect(within(table).queryByText("2026-11-01")).not.toBeInTheDocument();
  expect(screen.getByText("2 days")).toBeInTheDocument();
});

test("staffing chart uses recommendations, including a closed day with zero staff", () => {
  render(<StaffingOverviewChart data={[
    { date: "2026-10-30", recommended_staff: 3 },
    { date: "2026-10-31", recommended_staff: 0 },
  ]} />);
  const table = screen.getByRole("table", { name: "Staffing overview" });
  expect(within(table).getByText("3")).toBeInTheDocument();
  expect(within(table).getByText("0")).toBeInTheDocument();
});
