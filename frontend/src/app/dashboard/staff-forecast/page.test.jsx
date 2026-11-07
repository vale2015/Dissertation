import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, test, vi } from "vitest";
import StaffForecastPage from "./page";
import useSession from "@/hooks/useSession";

const query = vi.hoisted(() => ({ date: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(query.date ? `date=${query.date}` : "") }));
vi.mock("@/hooks/useSession", () => ({ default: vi.fn(() => ({ user: null })) }));

function forecast(days = 7) {
  const roles = [
    { department: "Floor", role_name: "Server", required_staff: 2, hourly_rate: 10, shift_hours: 8, estimated_cost: 160 },
    { department: "Kitchen", role_name: "Chef", required_staff: 1, hourly_rate: 12, shift_hours: 8, estimated_cost: 96 },
    { department: "Bar", role_name: "Bartender", required_staff: 1, hourly_rate: 10, shift_hours: 8, estimated_cost: 80 },
    { department: "Management", role_name: "Supervisor", required_staff: 1, hourly_rate: 18, shift_hours: 8, estimated_cost: 144 },
  ];
  const daily_totals = Array.from({ length: days }, (_, index) => {
    const date = new Date(Date.UTC(2026, 10, 10 + index)).toISOString().slice(0, 10);
    const closed = date === "2026-11-16";
    return {
      forecast_date: date, closed, closure_reason: closed ? "Monday" : null,
      predicted_covers: closed ? 0 : 32, total_estimated_cost: closed ? 0 : 480,
      rule_applied: closed ? null : { min_covers: 31, max_covers: 40 },
    };
  });
  return {
    run_id: 42, selected_date: "2026-11-09", model_version: "sample-version",
    daily_totals,
    results: daily_totals.filter((day) => !day.closed).flatMap((day) => roles.map((role) => ({ ...role, forecast_date: day.forecast_date }))),
  };
}

const response = (body, ok = true, status = ok ? 201 : 500) => ({ ok, status, json: async () => body });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); query.date = ""; vi.clearAllMocks(); });

test("shows accurate staffing, cost and saved-run information without suggesting a rota", async () => {
  const fetchMock = vi.fn().mockResolvedValue(response(forecast()));
  vi.stubGlobal("fetch", fetchMock);
  render(<StaffForecastPage />);

  expect(await screen.findByRole("heading", { name: "Day-by-day plan" })).toBeInTheDocument();
  expect(fetchMock.mock.calls[0][0]).toBe("/api/backend/staff-cost/forecast?days_ahead=7");
  expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  expect(screen.getByText("Saved run #42")).toBeInTheDocument();
  expect(screen.queryByText(/Based on demand through|Changing the horizon creates a new saved run/)).not.toBeInTheDocument();
  expect(screen.getByText("Average recommended staff").closest(".summary-card")).toHaveTextContent("5.0");
  expect(screen.getByText("Predicted covers", { selector: ".summary-card-label" }).closest(".summary-card")).toHaveTextContent("192");
  expect(screen.getByText("Estimated labour cost", { selector: ".summary-card-label" }).closest(".summary-card")).toHaveTextContent("£2,880.00");
  expect(screen.getAllByText(/not a scheduled rota/).length).toBeGreaterThan(0);
  expect(screen.getByRole("heading", { name: "Role and cost breakdown" })).toBeInTheDocument();
  expect(screen.getByRole("cell", { name: "Chef" })).toBeInTheDocument();
});

test("cost view is read-only and changing horizon creates a ten-day saved run", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(response(forecast())).mockResolvedValue(response(forecast(10)));
  vi.stubGlobal("fetch", fetchMock);
  render(<StaffForecastPage />);
  await screen.findByRole("heading", { name: "Day-by-day plan" });

  fireEvent.click(screen.getByRole("button", { name: "Labour cost" }));
  expect(screen.getByRole("heading", { name: "Estimated labour cost by day" })).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "10 days" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(fetchMock.mock.calls[1][0]).toBe("/api/backend/staff-cost/forecast?days_ahead=10");
  expect(await screen.findByText("Saved run #42")).toBeInTheDocument();
});

test("closed days have no invented staffing and can be selected with a button", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(forecast())));
  render(<StaffForecastPage />);
  await screen.findByRole("heading", { name: "Day-by-day plan" });

  fireEvent.click(screen.getByRole("button", { name: /16-11-2026 Monday/ }));
  const details = screen.getByRole("region", { name: "Selected day" });
  expect(within(details).getByText(/No staff or labour cost is forecast/)).toBeInTheDocument();
  expect(screen.getByText("No roles are needed on this closed day.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /16-11-2026 Monday/ })).toHaveAttribute("aria-pressed", "true");
  expect(within(details).getByRole("status")).toHaveTextContent("Selected Monday, 16-11-2026. Restaurant closed.");
});

test("only authorized users can follow the staffing-rule link into Settings", async () => {
  useSession.mockReturnValue({ user: { permissions: ["manage_staffing_rules"] } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(forecast())));
  render(<StaffForecastPage />);
  await screen.findByRole("heading", { name: "Day-by-day plan" });
  expect(screen.getByRole("link", { name: "Review staffing rules in Settings" })).toHaveAttribute("href", "/dashboard/settings#rules");
});

test("invalid dashboard date makes no write request", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  query.date = "2026-02-30";
  render(<StaffForecastPage />);
  expect(await screen.findByText("Choose a valid historical date in the dashboard calendar.")).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("insufficient history shows an empty state rather than zero staffing", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ error: "A complete 7- or 10-day forecast is required." }, false, 422)));
  render(<StaffForecastPage />);
  expect(await screen.findByRole("heading", { name: "No staffing forecast available" })).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Staffing forecast summary" })).not.toBeInTheDocument();
});

test("service failure has a retry and an incomplete cost does not appear as zero", async () => {
  const bad = forecast();
  bad.daily_totals[0].total_estimated_cost = null;
  const fetchMock = vi.fn().mockResolvedValueOnce(response({ error: "Service unavailable" }, false))
    .mockResolvedValueOnce(response(bad));
  vi.stubGlobal("fetch", fetchMock);
  render(<StaffForecastPage />);
  expect(await screen.findByText("Service unavailable")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("The staffing data was incomplete. Please try again.")).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Staffing forecast summary" })).not.toBeInTheDocument();
});
