import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { cookies } from "next/headers";
import { GET, POST } from "./route";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const backendUrl = "https://backend.example/api";
const ok = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

beforeEach(() => {
  process.env.BACKEND_API_URL = backendUrl;
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.CLOUDFLARE_API_TOKEN;
  cookies.mockResolvedValue({ get: () => ({ value: "session-token" }) });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok({ user: { id: 7, role: "manager" } })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  delete process.env.BACKEND_API_URL;
});

function message(value, origin = "https://app.example") {
  return new Request("https://app.example/api/chatbot", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ message: value }),
  });
}

test("signed-out and non-manager requests cannot read weather or use the assistant", async () => {
  cookies.mockResolvedValueOnce({ get: () => undefined });
  expect((await GET()).status).toBe(401);
  fetch.mockResolvedValueOnce(ok({ user: { id: 8, role: "supervisor" } }));
  expect((await POST(message("manage staff"))).status).toBe(403);
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("cross-origin POST is rejected before authentication or a business request", async () => {
  const response = await POST(message("weather", "https://other.example"));
  expect(response.status).toBe(403);
  expect(fetch).not.toHaveBeenCalled();
});

test("opening chat fetches weather after manager verification without model access", async () => {
  fetch.mockResolvedValueOnce(ok({ user: { id: 7, role: "manager" } }));
  fetch.mockResolvedValueOnce(ok({ success: true, data: { location: { city: "London" }, current: { temperature: 11, condition: "Cloudy" } } }));
  const response = await GET();
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.weather.text).toContain("11°C");
  expect(body.model_enabled).toBe(false);
  expect(fetch.mock.calls[1][0]).toBe(`${backendUrl}/weather/`);
});

test("staff request opens in-chat workspace and never sends staff data to the model", async () => {
  const response = await POST(message("manage staff"));
  expect(response.status).toBe(200);
  expect((await response.json()).workspace).toBe("staff");
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("report request calls the protected backend with server-side session", async () => {
  fetch.mockResolvedValueOnce(ok({ user: { id: 7, role: "manager" } }));
  fetch.mockResolvedValueOnce(ok({ metadata: { selected_date: "2026-11-29", currency: "GBP" }, summary: { forecasted_covers: 50, open_days: 7 }, financials: { estimated_labour_cost: 500 } }));
  const response = await POST(message("report for 2026-11-29"));
  expect(response.status).toBe(200);
  expect((await response.json()).text).toContain("50 forecast covers");
  expect(fetch.mock.calls[1][0]).toContain("/reports/management?");
  expect(fetch.mock.calls[1][1].headers.Authorization).toBe("Bearer session-token");
});

test("undated report uses the latest available backend date", async () => {
  fetch.mockResolvedValueOnce(ok({ user: { id: 7, role: "manager" } }));
  fetch.mockResolvedValueOnce(ok({ latest_record: { date: "2026-11-29" } }));
  fetch.mockResolvedValueOnce(ok({ metadata: { selected_date: "2026-11-29", days_ahead: 7, currency: "GBP" }, summary: { forecasted_covers: 50, open_days: 7 }, financials: { estimated_labour_cost: 500 } }));
  const response = await POST(message("generate a report"));
  expect(response.status).toBe(200);
  expect(fetch.mock.calls[1][0]).toBe(`${backendUrl}/dashboard/`);
  expect(fetch.mock.calls[2][0]).toContain("selected_date=2026-11-29");
});
