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
});
