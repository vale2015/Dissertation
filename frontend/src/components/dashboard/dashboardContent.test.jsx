import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, test, vi } from "vitest";
import DashboardContent from "./dashboardContent";
import { getISODateInTimeZone } from "@/utils/DateFormat";

const push = vi.hoisted(() => vi.fn());
const selectedDateState = vi.hoisted(() => ({ value: "" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/hooks/useDashboardData", () => ({
  default: () => ({
    loading: false,
    error: null,
    selectedDate: selectedDateState.value,
    selectedMode: null,
    selectedHistoricalRecord: null,
    selectedForecastRecord: null,
    predictedCoversNext7Days: 42,
    staffNeededTomorrow: 3,
    peakDemandDay: "Saturday",
    weeklyData: [{ date: "2026-10-29", value: 25 }],
    forecastData: [{ date: "2026-10-30", predicted_total_covers: 42 }],
    financialSummary: { estimated_food_revenue: 100 },
    getStaffFromCovers: () => 3,
  }),
}));

afterEach(() => { cleanup(); push.mockClear(); selectedDateState.value = ""; });

test("dashboard ends with charts and omits the redundant cards below them", () => {
  render(<DashboardContent user={{ full_name: "Valerio Gerardi" }} today="2026-10-30" />);
  expect(screen.getByRole("heading", { name: /Good morning, Valerio/ })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Bookings trend" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Cumulative demand" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Latest operational snapshot" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Financial context" })).not.toBeInTheDocument();
  expect(screen.queryByRole("navigation", { name: "Quick actions" })).not.toBeInTheDocument();
});

test("today is preselected and choosing another day waits for Apply", () => {
  render(<DashboardContent user={{ full_name: "Valerio Gerardi" }} today="2026-10-30" />);
  const input = screen.getByLabelText("View a day");
  const apply = screen.getByRole("button", { name: "Apply" });
  expect(input).toHaveValue("2026-10-30");
  expect(apply).toBeEnabled();

  fireEvent.change(input, { target: { value: "2026-11-30" } });
  expect(input).toHaveValue("2026-11-30");
  expect(push).not.toHaveBeenCalled();

  fireEvent.click(apply);
  expect(push).toHaveBeenCalledWith("/dashboard?date=2026-11-30");
});

test("an applied URL date takes precedence and returning to overview restores today", () => {
  selectedDateState.value = "2026-11-30";
  const props = { user: { full_name: "Valerio Gerardi" }, today: "2026-10-30" };
  const view = render(<DashboardContent {...props} />);
  const input = screen.getByLabelText("View a day");
  expect(input).toHaveValue("2026-11-30");
  expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();

  fireEvent.change(input, { target: { value: "2026-12-01" } });
  fireEvent.click(screen.getAllByRole("button", { name: "Show overview" })[0]);
  expect(push).toHaveBeenCalledWith("/dashboard");
  selectedDateState.value = "";
  view.rerender(<DashboardContent {...props} />);
  expect(screen.getByLabelText("View a day")).toHaveValue("2026-10-30");
});

test("today uses the London calendar day around the UTC boundary", () => {
  expect(getISODateInTimeZone(new Date("2026-06-01T23:30:00Z"))).toBe("2026-06-02");
  expect(getISODateInTimeZone(new Date("2026-10-30T23:30:00Z"))).toBe("2026-10-30");
});
