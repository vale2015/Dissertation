import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, test, vi } from "vitest";
import DashboardContent from "./dashboardContent";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
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

afterEach(cleanup);

test("dashboard ends with charts and omits the redundant cards below them", () => {
  render(<DashboardContent user={{ full_name: "Valerio Gerardi" }} />);
  expect(screen.getByRole("heading", { name: /Good morning, Valerio/ })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Bookings trend" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Cumulative demand" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Latest operational snapshot" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Financial context" })).not.toBeInTheDocument();
  expect(screen.queryByRole("navigation", { name: "Quick actions" })).not.toBeInTheDocument();
});
