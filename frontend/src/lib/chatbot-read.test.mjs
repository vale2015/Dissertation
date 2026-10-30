import assert from "node:assert/strict";
import test from "node:test";
import { classifyChatbotMessage, chatbotReadTarget, summarizeChatbotResult, validChatbotContext } from "./chatbot-read.mjs";

test("typed requests route to allowlisted restaurant operations", () => {
  assert.equal(classifyChatbotMessage("How is the weather?").intent, "weather");
  assert.deepEqual(classifyChatbotMessage("events from 2026-11-01 to 2026-11-07"), { intent: "events", dates: ["2026-11-01", "2026-11-07"] });
  assert.equal(classifyChatbotMessage("show past reports").intent, "report_history");
  assert.deepEqual(classifyChatbotMessage("view report 23"), { intent: "report_detail", reportId: 23 });
  assert.deepEqual(classifyChatbotMessage("download report 23 csv"), { intent: "report_download", reportId: 23, format: "csv" });
  assert.deepEqual(classifyChatbotMessage("save report for 2026-11-29"), { intent: "report_save", date: "2026-11-29", days: 7 });
  assert.equal(classifyChatbotMessage("suspend staff member").intent, "staff");
  assert.equal(classifyChatbotMessage("show report for 2026-11-29").intent, "report");
  assert.equal(classifyChatbotMessage("Check today's bookings").intent, "bookings_today");
  assert.equal(classifyChatbotMessage("Show reservation forecast").intent, "reservation_forecast");
  assert.equal(classifyChatbotMessage("Suggest staffing for this week").intent, "staffing_forecast");
});

test("invalid dates and excessive input are rejected", () => {
  assert.match(classifyChatbotMessage("events 2026-02-30 2026-03-01").error, /valid date/);
  assert.match(classifyChatbotMessage("a".repeat(501)).error, /500/);
  assert.match(chatbotReadTarget({ intent: "events", dates: ["2026-11-01", "2026-12-10"] }).error, /31 days/);
});

test("follow-up report requests use only validated client context", () => {
  const context = validChatbotContext({ last_report_date: "2026-11-29", last_report_days: 10, last_report_id: 23 });
  assert.deepEqual(classifyChatbotMessage("save it", context), { intent: "report_save", date: "2026-11-29", days: 10 });
  assert.deepEqual(classifyChatbotMessage("download it as pdf", context), { intent: "report_download", reportId: 23, format: "pdf" });
  assert.equal(validChatbotContext({ last_report_id: "../../admin" }), null);
});

test("backend targets are fixed to known protected routes", () => {
  assert.deepEqual(chatbotReadTarget({ intent: "weather" }), { path: "/weather/", method: "GET" });
  assert.deepEqual(chatbotReadTarget({ intent: "bookings_today" }), { path: "/booking/today-summary", method: "GET" });
  assert.deepEqual(chatbotReadTarget({ intent: "reservation_forecast" }), { path: "/demand/forecast?days=7", method: "GET" });
  assert.deepEqual(chatbotReadTarget({ intent: "staffing_forecast" }), { path: "/staff-cost/", method: "GET" });
  assert.deepEqual(chatbotReadTarget({ intent: "staff" }), { workspace: "staff", search: "" });
  assert.deepEqual(classifyChatbotMessage("find staff Alex Example"), { intent: "staff", search: "Alex Example" });
  assert.deepEqual(chatbotReadTarget({ intent: "report_download", reportId: 4, format: "pdf" }), { download: "saved", reportId: 4, format: "pdf" });
  assert.deepEqual(chatbotReadTarget({ intent: "report", days: 7 }), { resolve: "latest_report", intent: "report", days: 7, format: undefined });
  assert.match(chatbotReadTarget({ intent: "events", dates: [] }, new Date("2026-10-25T12:00:00Z")).path, /start_date=2026-10-25&end_date=2026-10-31/);
});

test("answers use source values and label unavailable events", () => {
  const weather = summarizeChatbotResult({ intent: "weather" }, { success: true, data: { location: { city: "London" }, current: { temperature: 11, condition: "Cloudy" }, stale: true } });
  assert.match(weather.text, /11°C/);
  assert.match(weather.text, /out of date/);
  const events = summarizeChatbotResult({ intent: "events" }, { success: true, data: { days: [{ date: "2026-11-01", supported: false, events: [] }] } });
  assert.match(events.text, /unavailable/);
  const saved = summarizeChatbotResult({ intent: "report_save", date: "2026-11-29" }, { report: { id: 9 } });
  assert.match(saved.text, /2026-11-29/);
  const bookings = summarizeChatbotResult({ intent: "bookings_today" }, { date: "2026-10-30", booking_count: 1, booked_covers: 3, bookings: [{ booking_time: "18:00:00", party_size: 3, booking_type: "advance" }] });
  assert.match(bookings.text, /1 booking for 3 booked covers/);
  const forecast = summarizeChatbotResult({ intent: "reservation_forecast" }, { forecast: [{ date: "2026-10-31", predicted_total_covers: 42 }] });
  assert.match(forecast.text, /42 covers/);
  const staffing = summarizeChatbotResult({ intent: "staffing_forecast" }, [{ forecast_date: "2026-10-31", required_staff: 2 }, { forecast_date: "2026-10-31", required_staff: 3 }]);
  assert.match(staffing.text, /5 staff/);
});
