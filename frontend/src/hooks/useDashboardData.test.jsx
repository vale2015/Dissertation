import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import useDashboardData from "./useDashboardData";

const navigation = vi.hoisted(() => ({ date: "" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams({ date: navigation.date }),
}));
vi.mock("@/lib/api", () => ({ API_BASE: "/api" }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("a selected forecast day uses the current forecast instead of requesting a forecast from that future date", async () => {
  navigation.date = "2026-11-30";
  const responses = {
    "/api/dashboard/": { summary: {}, latest_record: {}, financial_summary: {} },
    "/api/demand/forecast": { forecast: [{ date: "2026-11-30", predicted_total_covers: 26 }] },
    "/api/demand/weekly": [],
    "/api/demand/": [{ date: "2026-11-29", total_covers: 30 }],
  };
  const fetch = vi.fn(async (url) => ({ ok: true, json: async () => responses[url] }));
  vi.stubGlobal("fetch", fetch);

  const { result } = renderHook(() => useDashboardData());
  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(fetch.mock.calls.map(([url]) => url)).toContain("/api/demand/forecast");
  expect(fetch.mock.calls.some(([url]) => url.includes("selected_date"))).toBe(false);
  expect(result.current.selectedMode).toBe("forecast");
  expect(result.current.selectedForecastRecord.predicted_total_covers).toBe(26);
});
