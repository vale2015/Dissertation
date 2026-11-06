import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, test, vi } from "vitest";
import ReservationForecastPage from "./page";

const query = vi.hoisted(() => ({ date: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(query.date ? `date=${query.date}` : "") }));

const sample = {
  selected_date: "2026-11-08", model: "random_forest", model_version: "demo-v1",
  forecast: [
    { date: "2026-11-09", day_of_week: "Monday", closed: true, closure_reason: "Weekly closure", predicted_total_covers: 99 },
    { date: "2026-11-10", day_of_week: "Tuesday", closed: false, predicted_total_covers: 10 },
    { date: "2026-11-11", day_of_week: "Wednesday", closed: false, predicted_total_covers: 20 },
  ],
};
const response = (body, ok = true) => ({ ok, json: async () => body });

afterEach(() => { cleanup(); vi.unstubAllGlobals(); query.date = ""; });

test("shows truthful forecast metrics and separates a closed day", async () => {
  const fetchMock = vi.fn().mockResolvedValue(response(sample));
  vi.stubGlobal("fetch", fetchMock);
  render(<ReservationForecastPage />);
  expect(await screen.findByRole("heading", { name: "Day-by-day forecast" })).toBeInTheDocument();
  expect(screen.getByText("Expected covers by service day—not confirmed bookings.")).toBeInTheDocument();
  expect(screen.getByText("Predicted covers", { selector: ".summary-card-label" }).closest(".summary-card")).toHaveTextContent("30");
  expect(screen.getByText("Average open day").closest(".summary-card")).toHaveTextContent("15");
  expect(screen.getByText("Closed days").closest(".summary-card")).toHaveTextContent("1");
  expect(screen.getByText("Weekly closure")).toBeInTheDocument();
  expect(fetchMock.mock.calls[0][0]).toBe("/api/backend/demand/forecast?days=7");
});

test("switching the horizon requests ten days", async () => {
  const fetchMock = vi.fn().mockResolvedValue(response(sample));
  vi.stubGlobal("fetch", fetchMock);
  render(<ReservationForecastPage />);
  await screen.findByRole("heading", { name: "Day-by-day forecast" });
  fireEvent.click(screen.getByRole("button", { name: "10 days" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(fetchMock.mock.calls[1][0]).toBe("/api/backend/demand/forecast?days=10");
  expect(screen.getByRole("button", { name: "10 days" })).toHaveAttribute("aria-pressed", "true");
});

test("empty forecast explains the gap instead of showing zero-valued cards", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ forecast: [], message: "Selected date is not available in the historical dataset." })));
  render(<ReservationForecastPage />);
  expect(await screen.findByRole("heading", { name: "No forecast available" })).toBeInTheDocument();
  expect(screen.getByText(/not available in the historical dataset/)).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Forecast summary" })).not.toBeInTheDocument();
});

test("an unavailable service can be retried", async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(response({}, false)).mockResolvedValue(response(sample));
  vi.stubGlobal("fetch", fetchMock);
  render(<ReservationForecastPage />);
  expect(await screen.findByRole("heading", { name: "Forecast unavailable" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("heading", { name: "Day-by-day forecast" })).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test.each([null, "", "  "])("an incomplete open-day prediction (%s) is not presented as zero demand", async (prediction) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ ...sample, forecast: [{ ...sample.forecast[1], predicted_total_covers: prediction }] })));
  render(<ReservationForecastPage />);
  expect(await screen.findByRole("heading", { name: "Forecast unavailable" })).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Forecast summary" })).not.toBeInTheDocument();
});

test("invalid date is rejected before an API call; valid historical date is passed through", async () => {
  const fetchMock = vi.fn().mockResolvedValue(response(sample));
  vi.stubGlobal("fetch", fetchMock);
  query.date = "2026-02-30";
  const first = render(<ReservationForecastPage />);
  expect(await screen.findByText("Choose a valid historical date to view a forecast.")).toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
  first.unmount();
  query.date = "2026-11-08";
  render(<ReservationForecastPage />);
  await screen.findByRole("heading", { name: "Day-by-day forecast" });
  expect(fetchMock.mock.calls[0][0]).toBe("/api/backend/demand/forecast?days=7&date=2026-11-08");
});
