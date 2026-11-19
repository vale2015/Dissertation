import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { cookies } from "next/headers";
import { GET, POST } from "./route";
import { classifyWithCloudflare, cloudflareModelAvailable } from "@/lib/chatbot-model.mjs";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/chatbot-model.mjs", async (importOriginal) => ({ ...(await importOriginal()), classifyWithCloudflare: vi.fn(), cloudflareModelAvailable: vi.fn(() => false) }));

const backendUrl = "https://backend.example/api";
const ok = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(), json: async () => body });

beforeEach(() => {
  process.env.BACKEND_API_URL = backendUrl;
  delete process.env.CLOUDFLARE_ACCOUNT_ID;
  delete process.env.CLOUDFLARE_API_TOKEN;
  cloudflareModelAvailable.mockReturnValue(false);
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

test("unknown PII without local task signals never reserves a budget or calls the provider", async () => {
  cloudflareModelAvailable.mockReturnValue(true);
  await POST(message("Alice alex@example.test +447700900001 yes"));
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(classifyWithCloudflare).not.toHaveBeenCalled();
});

test("every provider call reserves a durable budget first and receives only task constants", async () => {
  cloudflareModelAvailable.mockReturnValue(true);
  fetch.mockResolvedValueOnce(ok({ user: { id: 7, role: "manager" } }));
  fetch.mockResolvedValueOnce(ok({ allowed: true }));
  classifyWithCloudflare.mockResolvedValueOnce("unknown");
  await POST(message("nearby happenings Alice alex@example.test secret=123456"));
  expect(fetch.mock.calls[1][0]).toBe(`${backendUrl}/staff/chat-model-budget`);
  expect(fetch.mock.calls[1][1]).toMatchObject({ method: "POST", body: "{}", headers: expect.objectContaining({ Authorization: "Bearer session-token" }) });
  expect(classifyWithCloudflare).toHaveBeenCalledWith("events");
});

test("budget refusal prevents inference and forwards a bounded retry delay", async () => {
  cloudflareModelAvailable.mockReturnValue(true);
  fetch.mockResolvedValueOnce(ok({ user: { id: 7, role: "manager" } }));
  fetch.mockResolvedValueOnce({ ...ok({ error: { message: "Limited" } }, 429), headers: new Headers({ "Retry-After": "60" }) });
  const result = await POST(message("nearby happenings"));
  expect((await result.json()).category).toBe("budget_exhausted");
  expect(result.headers.get("Retry-After")).toBe("60");
  expect(classifyWithCloudflare).not.toHaveBeenCalled();
});

test("model failure reports an enumerated diagnostic without leaking provider error text", async () => {
  cloudflareModelAvailable.mockReturnValue(true);
  fetch.mockResolvedValueOnce(ok({ user: { id: 7, role: "manager" } }));
  fetch.mockResolvedValueOnce(ok({ allowed: true }));
  classifyWithCloudflare.mockRejectedValueOnce({ statusCode: 403, message: "secret provider token" });
  const logger = vi.spyOn(console, "warn").mockImplementation(() => {});
  const result = await POST(message("nearby happenings"));
  const body = await result.json();
  expect(body.category).toBe("provider_auth");
  expect(JSON.stringify(body)).not.toContain("secret");
  expect(logger).toHaveBeenCalledWith("chatbot_model_failure", { category: "provider_auth" });
  logger.mockRestore();
});

test("fresh-chat command resets after manager verification without a model or business API call", async () => {
  cloudflareModelAvailable.mockReturnValue(true);
  const response = await POST(message("start a brand new chat"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ reset: true });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(classifyWithCloudflare).not.toHaveBeenCalled();
});

test("fresh-chat command remains manager-only", async () => {
  cookies.mockResolvedValueOnce({ get: () => undefined });
  expect((await POST(message("new chat"))).status).toBe(401);
  fetch.mockResolvedValueOnce(ok({ user: { id: 8, role: "staff" } }));
  expect((await POST(message("reset conversation"))).status).toBe(403);
  expect(classifyWithCloudflare).not.toHaveBeenCalled();
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

test("10-day report generation, save and download keep the selected horizon", async () => {
  fetch.mockResolvedValueOnce(ok({ user: { id: 7, role: "manager" } }));
  fetch.mockResolvedValueOnce(ok({ metadata: { selected_date: "2026-06-15", days_ahead: 10, currency: "GBP" }, summary: { forecasted_covers: 50, open_days: 10 }, financials: { estimated_labour_cost: 500 } }));
  const generated = await POST(message("generate a 10-day report for 2026-06-15"));
  expect(generated.status).toBe(200);
  expect(fetch.mock.calls[1][0]).toContain("days_ahead=10");

  fetch.mockResolvedValueOnce(ok({ user: { id: 7, role: "manager" } }));
  fetch.mockResolvedValueOnce(ok({ report: { id: 8 } }));
  const saved = await POST(message("save 10-day report for 2026-06-15"));
  expect(saved.status).toBe(200);
  expect(JSON.parse(fetch.mock.calls[3][1].body)).toEqual({ selected_date: "2026-06-15", days_ahead: 10 });

  fetch.mockResolvedValueOnce(ok({ user: { id: 7, role: "manager" } }));
  const download = await POST(message("download 10-day report for 2026-06-15 as pdf"));
  expect(download.status).toBe(200);
  expect((await download.json()).download).toEqual({ download: "fresh", selectedDate: "2026-06-15", days: 10, format: "pdf" });
  expect(fetch).toHaveBeenCalledTimes(5);
});

test("undated report asks for a calendar choice without model or backend report calls", async () => {
  cloudflareModelAvailable.mockReturnValue(true);
  const response = await POST(message("generate a report"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    text: "Choose a date in the calendar below to generate your report. You can also type a date as YYYY-MM-DD.",
    date_picker: { intent: "report", days: 7, format: null },
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(classifyWithCloudflare).not.toHaveBeenCalled();
});

test("today's bookings use a bounded, protected backend summary", async () => {
  fetch.mockResolvedValueOnce(ok({ user: { id: 7, role: "manager" } }));
  fetch.mockResolvedValueOnce(ok({ date: "2026-10-30", booking_count: 2, booked_covers: 5, bookings: [] }));
  const response = await POST(message("Check today's bookings"));
  expect(response.status).toBe(200);
  expect((await response.json()).text).toContain("2 bookings for 5 booked covers");
  expect(fetch.mock.calls[1][0]).toBe(`${backendUrl}/booking/today-summary`);
});
