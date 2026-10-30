const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/g;

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validChatbotContext(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const date = value.last_report_date;
  const days = value.last_report_days;
  const id = value.last_report_id;
  if (date != null && !validDate(date)) return null;
  if (days != null && ![7, 10].includes(days)) return null;
  if (id != null && (!Number.isInteger(id) || id < 1 || id > 999999999)) return null;
  if (Object.keys(value).some((key) => !["last_report_date", "last_report_days", "last_report_id"].includes(key))) return null;
  return { last_report_date: date || null, last_report_days: days || 7, last_report_id: id || null };
}

export function classifyChatbotMessage(message, context = null) {
  const text = typeof message === "string" ? message.trim() : "";
  if (!text || text.length > 500) return { error: "Enter a message of up to 500 characters." };
  const lower = text.toLowerCase();
  const dates = [...text.matchAll(ISO_DATE)].map((match) => match[0]);
  if (dates.some((date) => !validDate(date))) return { error: "Use a valid date in YYYY-MM-DD format." };

  if (/^save (it|that|this)( report)?[.!]?$/i.test(text) && context?.last_report_date) {
    return { intent: "report_save", date: context.last_report_date, days: context.last_report_days };
  }
  if (/^download (it|that|this)( report)?( as)? (pdf|csv)[.!]?$/i.test(text)) {
    const format = /\bcsv\b/i.test(text) ? "csv" : "pdf";
    if (context?.last_report_id) return { intent: "report_download", reportId: context.last_report_id, format };
    if (context?.last_report_date) return { intent: "report_download_fresh", date: context.last_report_date, days: context.last_report_days, format };
  }

  if (/\b(booking|bookings|reservation|reservations)\b/.test(lower) && /\b(today|tonight|current day)\b/.test(lower) && !/\bforecast\b/.test(lower)) {
    return { intent: "bookings_today" };
  }
  if (/\b(staffing|staff)\b/.test(lower) && /\b(forecast|suggest|recommend|required|need)\b/.test(lower)) {
    return { intent: "staffing_forecast" };
  }
  if (/\b(forecast|predict|predicted)\b/.test(lower) && /\b(reservation|reservations|demand|covers|booking|bookings)\b/.test(lower)) {
    return { intent: "reservation_forecast" };
  }

  if (/\b(staff|employee|employees|team members?|register|suspend|deactivate|reactivate|password reset|reset password)\b/.test(lower)) {
    const search = text.match(/^(?:find|show|search(?: for)?|look up)\s+(?:staff|employee|team member)\s+(.{1,80})$/i)?.[1]?.trim();
    return { intent: "staff", ...(search ? { search } : {}) };
  }
  if (/\b(weather|temperature|rain|sunny|conditions)\b/.test(lower)) return { intent: "weather" };
  if (/\b(event|events|concert|concerts|sports)\b/.test(lower)) {
    if (dates.length === 1) return { error: "For events, provide a start and end date in YYYY-MM-DD format." };
    if (dates.length > 2) return { error: "Use only a start and end date for events." };
    return { intent: "events", dates };
  }
  if (/\b(report|reports)\b/.test(lower)) {
    const reportId = lower.match(/\b(?:report\s*(?:#|id)?\s*)(\d{1,9})\b/);
    if (/\b(download|export)\b/.test(lower)) {
      const format = /\bcsv\b/.test(lower) ? "csv" : /\bpdf\b/.test(lower) ? "pdf" : null;
      if (!format) return { error: "Specify PDF or CSV for the download." };
      if (reportId && dates.length === 0) return { intent: "report_download", reportId: Number(reportId[1]), format };
      if (dates.length) return { intent: "report_download_fresh", date: dates[0], days: /\b10\s*days?\b/.test(lower) ? 10 : 7, format };
      return { error: "Tell me the saved report ID, or a date in YYYY-MM-DD format for a new report." };
    }
    if (reportId && dates.length === 0 && /\b(show|view|open|read|past|saved)\b/.test(lower)) return { intent: "report_detail", reportId: Number(reportId[1]) };
    if (/\b(past|saved|previous|history|old)\b/.test(lower) && !/\bsave\b/.test(lower)) return { intent: "report_history" };
    const days = /\b10\s*days?\b/.test(lower) ? 10 : 7;
    if (/\bsave\b/.test(lower)) return { intent: "report_save", date: dates[0] || null, days };
    return { intent: "report", date: dates[0] || null, days };
  }
  return { intent: "unknown" };
}

function calendarMonth(now) {
  const first = now.toISOString().slice(0, 10);
  const last = new Date(now.getTime() + 6 * 86400000).toISOString().slice(0, 10);
  return [first, last];
}

export function chatbotReadTarget(intent, now = new Date()) {
  switch (intent.intent) {
    case "bookings_today": return { path: "/booking/today-summary", method: "GET" };
    case "reservation_forecast": return { path: "/demand/forecast?days=7", method: "GET" };
    case "staffing_forecast": return { path: "/staff-cost/", method: "GET" };
    case "weather": return { path: "/weather/", method: "GET" };
    case "events": {
      const [start, end] = intent.dates?.length ? intent.dates : calendarMonth(now);
      const span = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000;
      if (span < 0 || span > 31) return { error: "Choose an event range of up to 31 days." };
      return { path: `/events/?${new URLSearchParams({ start_date: start, end_date: end })}`, method: "GET" };
    }
    case "report":
    case "report_save":
    case "report_download_fresh":
      if (!intent.date) return { resolve: "latest_report", intent: intent.intent, days: intent.days, format: intent.format };
      if (intent.intent === "report_save") return { path: "/reports/history", method: "POST", body: { selected_date: intent.date, days_ahead: intent.days } };
      if (intent.intent === "report_download_fresh") return { download: "fresh", selectedDate: intent.date, days: intent.days, format: intent.format };
      return { path: `/reports/management?${new URLSearchParams({ selected_date: intent.date, days_ahead: String(intent.days) })}`, method: "GET" };
    case "report_history": return { path: "/reports/history", method: "GET" };
    case "report_detail": return { path: `/reports/history/${intent.reportId}`, method: "GET" };
    case "report_download": return { download: "saved", reportId: intent.reportId, format: intent.format };
    case "staff": return { workspace: "staff", search: intent.search || "" };
    default: return { prompt: "I can check weather and local events, generate a report for a date, find past reports, or show staff accounts. What would you like?" };
  }
}

export function summarizeChatbotResult(intent, payload) {
  if (intent.intent === "bookings_today") {
    if (!Number.isInteger(payload?.booking_count) || !Number.isInteger(payload?.booked_covers) || !Array.isArray(payload?.bookings)) throw new Error("Today's bookings are unavailable.");
    const entries = payload.bookings.slice(0, 10).map((item) => `• ${item.booking_time?.slice(0, 5) || "Time unavailable"}: ${item.party_size} covers (${item.booking_type || "booking"})`);
    return { text: `For ${payload.date}, there are ${payload.booking_count} booking${payload.booking_count === 1 ? "" : "s"} for ${payload.booked_covers} booked covers.${entries.length ? `\n${entries.join("\n")}` : ""}${payload.booking_count > entries.length ? "\nShowing the first 10 by time." : ""}`, source: "bookings_today" };
  }
  if (intent.intent === "reservation_forecast") {
    if (!Array.isArray(payload?.forecast)) throw new Error("The reservation forecast is unavailable.");
    const days = payload.forecast.slice(0, 7);
    return { text: days.length ? `Predicted covers for the next ${days.length} forecast days:\n${days.map((item) => `• ${item.date}: ${item.predicted_total_covers ?? "unavailable"} covers${item.closed ? " (closed)" : ""}`).join("\n")}` : "No forecast is available yet.", source: "reservation_forecast" };
  }
  if (intent.intent === "staffing_forecast") {
    if (!Array.isArray(payload)) throw new Error("The staffing forecast is unavailable.");
    const totals = new Map();
    for (const row of payload) {
      if (!row.forecast_date) continue;
      totals.set(row.forecast_date, (totals.get(row.forecast_date) || 0) + Number(row.required_staff || 0));
    }
    const days = [...totals].slice(0, 7);
    return { text: days.length ? `Recommended staff from the active saved forecast (not scheduled shifts):\n${days.map(([date, count]) => `• ${date}: ${count} staff`).join("\n")}` : "No saved staffing forecast is available yet.", source: "staffing_forecast" };
  }
  if (intent.intent === "weather") {
    const weather = payload?.data;
    if (payload?.success !== true || !weather?.current) throw new Error("Weather is unavailable right now.");
    const city = weather.location?.city || "the restaurant";
    const temperature = weather.current.temperature;
    return {
      text: `In ${city}, it is ${temperature == null ? "an unknown temperature" : `${temperature}°C`} and ${weather.current.condition || "conditions are unavailable"}.${weather.stale ? " This reading may be out of date." : ""}`,
      source: "weather",
      updated_at: weather.fetched_at || null,
    };
  }
  if (intent.intent === "events") {
    if (payload?.success !== true || !Array.isArray(payload?.data?.days)) throw new Error("Local events are unavailable right now.");
    const events = payload.data.days.flatMap((day) => (day.events || []).map((event) => ({ date: day.date, name: event.name || event.title || "Unnamed event", source: event.provider || event.source || null }))).slice(0, 8);
    const unavailable = payload.data.days.every((day) => day.supported === false);
    return { text: unavailable ? "Local-event information is unavailable for that range." : events.length ? `I found ${events.length} event${events.length === 1 ? "" : "s"}:\n${events.map((event) => `• ${event.date}: ${event.name}${event.source ? ` (${event.source})` : ""}`).join("\n")}` : "No local events were found for that date range.", source: "events" };
  }
  if (intent.intent === "report") {
    if (!payload?.summary || !payload?.metadata) throw new Error("The report could not be generated.");
    return { text: `Report for ${payload.metadata.selected_date}: ${payload.summary.forecasted_covers} forecast covers across ${payload.summary.open_days} open days. Estimated labour cost: ${payload.financials?.estimated_labour_cost ?? "unavailable"} ${payload.metadata.currency || ""}. You can ask me to save it or download it as PDF or CSV.`, source: "report", report_ref: { selected_date: payload.metadata.selected_date, days_ahead: payload.metadata.days_ahead } };
  }
  if (intent.intent === "report_history") {
    const reports = Array.isArray(payload?.reports) ? payload.reports.slice(0, 10) : null;
    if (!reports) throw new Error("Past reports are unavailable right now.");
    return { text: reports.length ? `Recent saved reports:\n${reports.map((report) => `• ${report.selected_date}: ${report.days_ahead}-day report (ID ${report.id})`).join("\n")}` : "There are no saved reports yet.", source: "report_history", reports };
  }
  if (intent.intent === "report_save") {
    if (!payload?.report?.id) throw new Error("The report could not be saved.");
    return { text: `Saved report #${payload.report.id} for ${intent.date}. Ask to view or download it by ID.`, source: "report_save", report_ref: { selected_date: intent.date, days_ahead: intent.days, id: payload.report.id } };
  }
  if (intent.intent === "report_detail") {
    if (!payload?.metadata || !payload?.summary) throw new Error("The saved report could not be opened.");
    return { text: `Saved report #${intent.reportId} for ${payload.metadata.selected_date}: ${payload.summary.forecasted_covers} forecast covers across ${payload.summary.open_days} open days. Estimated labour cost: ${payload.financials?.estimated_labour_cost ?? "unavailable"} ${payload.metadata.currency || ""}. You can ask me to download it as PDF or CSV.`, source: "report_detail", report_ref: { selected_date: payload.metadata.selected_date, days_ahead: payload.metadata.days_ahead, id: intent.reportId } };
  }
  if (intent.intent === "staff") {
    const staff = Array.isArray(payload?.staff) ? payload.staff.slice(0, 10) : null;
    if (!staff) throw new Error("Staff accounts are unavailable right now.");
    return { text: staff.length ? `Staff accounts:\n${staff.map((member) => `• ${member.full_name}: ${member.role}, ${member.status}`).join("\n")}` : "There are no staff accounts to show.", source: "staff" };
  }
  throw new Error("I could not complete that request.");
}
