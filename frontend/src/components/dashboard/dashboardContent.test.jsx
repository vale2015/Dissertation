import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, test, vi } from "vitest";
import DashboardContent from "./dashboardContent";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/hooks/useDashboardData", () => ({
  default: () => ({
    loading: false,
    error: null,
    selectedDate: null,
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

afterEach(() => { cleanup(); push.mockClear(); });

test("dashboard ends with charts and omits the redundant cards below them", () => {
  render(<DashboardContent user={{ full_name: "Valerio Gerardi" }} />);
  expect(screen.getByRole("heading", { name: /Good morning, Valerio/ })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Bookings trend" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Cumulative demand" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Latest operational snapshot" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Financial context" })).not.toBeInTheDocument();
  expect(screen.queryByRole("navigation", { name: "Quick actions" })).not.toBeInTheDocument();
});

test("choosing a day keeps the draft visible until Apply navigates to that date", () => {
  render(<DashboardContent user={{ full_name: "Valerio Gerardi" }} />);
  const input = screen.getByLabelText("View a day");
  const apply = screen.getByRole("button", { name: "Apply" });
  expect(apply).toBeDisabled();

  fireEvent.change(input, { target: { value: "2026-11-30" } });
  expect(input).toHaveValue("2026-11-30");
  expect(push).not.toHaveBeenCalled();

  fireEvent.click(apply);
  expect(push).toHaveBeenCalledWith("/dashboard?date=2026-11-30");
});
