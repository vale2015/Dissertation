import { cleanup, render, screen } from "@testing-library/react";
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

test("dashboard keeps only the view indicator beneath the greeting", () => {
  render(<DashboardContent user={{ full_name: "Valerio Gerardi" }} />);
  const view = screen.getByRole("region", { name: "Dashboard view" });
  expect(view).toHaveTextContent("Overview");
  expect(view).not.toHaveTextContent("View a day");
  expect(view).not.toHaveTextContent("Overview combines");
  expect(screen.queryByRole("button", { name: /View a day/ })).not.toBeInTheDocument();
});

test("selected date changes the dashboard view indicator", () => {
  selectedDateState.value = "2026-11-30";
  render(<DashboardContent user={{ full_name: "Valerio Gerardi" }} />);
  expect(screen.getByRole("region", { name: "Dashboard view" })).toHaveTextContent("Selected day");
});

test("today uses the London calendar day around the UTC boundary", () => {
  expect(getISODateInTimeZone(new Date("2026-06-01T23:30:00Z"))).toBe("2026-06-02");
  expect(getISODateInTimeZone(new Date("2026-10-30T23:30:00Z"))).toBe("2026-10-30");
});
