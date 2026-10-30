import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, test, vi } from "vitest";
import ReportsPage from "./page";

vi.mock("@/components/reports/report-summary", () => ({ default: () => <div>Saved report summary</div> }));
vi.mock("@/components/reports/report-financials", () => ({ default: () => null }));
vi.mock("@/components/reports/report-booking-mix", () => ({ default: () => null }));
vi.mock("@/components/reports/report-daily-table", () => ({ default: () => null }));
vi.mock("@/components/reports/report-insights", () => ({ default: () => null }));
vi.mock("@/components/reports/report-warnings", () => ({ default: () => null }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("Reports reads saved snapshots without generating, saving or downloading", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ reports: [{ id: 7, selected_date: "2026-10-29", days_ahead: 7, creator_name: "Manager" }], next_cursor: null }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ metadata: { selected_date: "2026-10-29", start_date: "2026-10-30", end_date: "2026-11-05" }, summary: {} }) });
  vi.stubGlobal("fetch", fetchMock);
  render(<ReportsPage />);
  await userEvent.setup().click(await screen.findByRole("button", { name: "View report #7" }));
  expect(await screen.findByText("Saved report summary")).toBeInTheDocument();
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/api/backend/reports/history", "/api/backend/reports/history/7"]);
  expect(screen.queryByRole("button", { name: /generate|download|save/i })).not.toBeInTheDocument();
});
