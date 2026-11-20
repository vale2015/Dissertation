"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import DatePicker from "react-datepicker";
import StaffConversation from "./StaffConversation";
import { staffCommand } from "@/lib/chatbot-staff.mjs";
import StaffManagement from "@/components/staff/StaffManagement";
import useSession from "@/hooks/useSession";
import { downloadManagementReport, downloadSavedReport } from "@/lib/report-download";
import { ROLES } from "@/lib/permissions";
import "react-datepicker/dist/react-datepicker.css";

const PANEL_ID = "rfs-assistant-panel";
const GREETING = "👋 Hi there! I’m your RFS Assistant! I’m here to make your day easier. Ask me about weather or local events, let me handle reports, or get help managing your staff. Just tell me what you need!";
const SUGGESTIONS = ["Check today's bookings", "Show reservation forecast", "Suggest staffing for this week", "Generate a report"];

function calendarDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function reportRequestForDate(date, pendingReport) {
  const horizon = `${pendingReport.days === 10 ? 10 : 7}-day report`;
  if (pendingReport.intent === "report_save") return `save ${horizon} for ${date}`;
  if (pendingReport.intent === "report_download_fresh") return `download ${horizon} for ${date} as ${pendingReport.format === "csv" ? "csv" : "pdf"}`;
  return `generate a ${horizon} for ${date}`;
}

export default function ManagerChat() {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([{ role: "assistant", text: GREETING }]);
  const [staffFlow, setStaffFlow] = useState(null);
  const [staffBusy, setStaffBusy] = useState(false);
  const staffRef = useRef(null);
  const [staffWorkspace, setStaffWorkspace] = useState(false);
  const [staffSearch, setStaffSearch] = useState("");
  const [modelEnabled, setModelEnabled] = useState(false);
  const [reportContext, setReportContext] = useState(null);
  const [pendingReport, setPendingReport] = useState(null);
  const launcherRef = useRef(null);
  const inputRef = useRef(null);
  const datePickerRef = useRef(null);
  const scrollRef = useRef(null);

  const append = useCallback((role, text) => {
    setMessages((current) => [...current, { role, text }]);
  }, []);

  const resetConversation = useCallback(async () => {
    try { await staffRef.current?.cancel(); } catch { setError("The staff draft could not be cancelled. Please try again before starting a new chat."); return; }
    setStaffFlow(null);
    setMessages([{ role: "assistant", text: GREETING }]);
    setReportContext(null);
    setPendingReport(null);
    setStaffWorkspace(false);
    setStaffSearch("");
    setInput("");
    setError("");
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => launcherRef.current?.focus());
  }, []);

  const exitStaffFlow = useCallback(() => {
    setStaffFlow(null);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setReady(false);
    setError("");
    fetch("/api/chatbot", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error || "The assistant is unavailable.");
        if (!body?.conversation_enabled) throw new Error("The assistant is unavailable.");
        setReady(true);
        setModelEnabled(Boolean(body.model_enabled));
        setMessages((current) => current.some((item) => item.kind === "weather")
          ? current
          : [...current, { role: "assistant", kind: "weather", text: body.weather?.text || body.weather_error || "Weather is unavailable right now." }]);
      })
      .catch((caught) => {
        if (caught.name !== "AbortError") setError(caught.message);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, staffWorkspace]);

  if (user?.role !== ROLES.MANAGER) return null;

  async function sendMessage(message, requestMessage = message) {
    if (!message || loading || !ready) return;
    const staff = staffCommand(message);
    if (staff) { setStaffFlow(staff); setStaffWorkspace(false); setPendingReport(null); setInput(""); return; }
    let focusCalendar = false;
    setInput("");
    setError("");
    append("user", message);
    setLoading(true);
    try {
      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: requestMessage, ...(reportContext ? { context: reportContext } : {}) }),
        cache: "no-store",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "I could not complete that request.");
      if (body.reset === true) {
        await resetConversation();
        return;
      }
      setPendingReport(body.date_picker || null);
      focusCalendar = Boolean(body.date_picker);
      if (body.download?.download === "saved") {
        await downloadSavedReport(body.download.reportId, body.download.format);
        append("assistant", `Downloaded saved report #${body.download.reportId} as ${body.download.format.toUpperCase()}.`);
      } else if (body.download?.download === "fresh") {
        await downloadManagementReport(body.download.format, body.download.selectedDate, body.download.days);
        append("assistant", `Downloaded the ${body.download.days}-day report for ${body.download.selectedDate} as ${body.download.format.toUpperCase()}.`);
      } else {
        append("assistant", body.text || "I could not complete that request.");
      }
      if (body.report_ref) {
        setReportContext({ last_report_date: body.report_ref.selected_date, last_report_days: body.report_ref.days_ahead, last_report_id: body.report_ref.id || null });
      }
      setStaffWorkspace(body.workspace === "staff");
      if (body.workspace === "staff") setStaffSearch(body.search || "");
    } catch (caught) {
      append("assistant", caught.message || "That request failed. Please try again.");
    } finally {
      setLoading(false);
      window.requestAnimationFrame(() => (focusCalendar ? datePickerRef.current : inputRef.current)?.focus());
    }
  }

  function submit(event) {
    event.preventDefault();
    const message = input.trim();
    const requestMessage = pendingReport && /^\d{4}-\d{2}-\d{2}$/.test(message)
      ? reportRequestForDate(message, pendingReport)
      : message;
    void sendMessage(message, requestMessage);
  }

  function chooseReportDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime()) || !pendingReport) return;
    const dateString = calendarDateString(date);
    void sendMessage(dateString, reportRequestForDate(dateString, pendingReport));
  }

  return (
    <div className="manager-chat">
      <button
        ref={launcherRef}
        className="manager-chat-launcher"
        type="button"
        aria-label={open ? "Close RFS assistant" : "Open RFS assistant"}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        onClick={open ? close : () => setOpen(true)}
      >
        <Image src="/brand/rfs-ai-mascot-v2.png" alt="" width={45} height={45} /><span>RFS AI</span>
      </button>

      {open && (
        <section className="manager-chat-panel" id={PANEL_ID} role="dialog" aria-modal="false" aria-labelledby="manager-chat-title">
          <header className="manager-chat-header">
            <div className="manager-chat-brand">
              <Image src="/brand/rfs-ai-mascot-v2.png" alt="" width={56} height={56} />
              <div>
                <h2 id="manager-chat-title">RFS AI</h2>
                <p>{modelEnabled ? "Restaurant assistant · AI configured" : "Restaurant tools"}</p>
              </div>
            </div>
            <div className="manager-chat-header-actions">
              <button type="button" className="manager-chat-new" onClick={resetConversation} disabled={!ready || loading || (staffFlow && staffBusy)}>New chat</button>
              <button type="button" aria-label="Close assistant" onClick={close}>×</button>
            </div>
          </header>
          <div className="manager-chat-messages" ref={scrollRef} aria-live="polite">
            {messages.map((item, index) => (
              <div className={`manager-chat-message manager-chat-${item.role}`} key={index}>
                <span>{item.role === "user" ? "You" : "RFS"}</span>
                <p>{item.text}</p>
              </div>
            ))}
            {ready && !staffFlow && !staffWorkspace && !messages.some((item) => item.role === "user") && <div className="manager-chat-suggestions" aria-label="Suggested requests">
              <button type="button" disabled={loading} onClick={() => { setStaffFlow({ kind: "choose" }); setStaffWorkspace(false); setPendingReport(null); setInput(""); }}>Manage staff</button>
              {SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}>{suggestion}</button>)}
            </div>}
            {loading && <p className="manager-chat-pending" role="status">Working on your request…</p>}
            {error && <p className="manager-chat-error" role="alert">{error}</p>}
            {pendingReport && ready && !loading && <div ref={datePickerRef} className="manager-chat-date-picker" role="group" aria-labelledby="manager-chat-date-picker-title" tabIndex={-1}>
              <p id="manager-chat-date-picker-title">Choose a report date</p>
              <DatePicker
                inline
                selected={null}
                onChange={chooseReportDate}
                openToDate={new Date()}
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
                calendarClassName="custom-datepicker manager-chat-calendar"
              />
            </div>}
            {staffFlow && <StaffConversation key={user.id} ref={staffRef} command={staffFlow} actorId={user.id} onBusyChange={setStaffBusy} onExit={exitStaffFlow} onOtherControls={() => { setStaffFlow(null); setStaffWorkspace(true); }} />}
            {staffWorkspace && <div className="manager-chat-workspace"><StaffManagement initialSearch={staffSearch} /></div>}
          </div>
          {!staffFlow && <form className="manager-chat-composer" onSubmit={submit}>
            <label htmlFor="manager-chat-input">Your message</label>
            <div>
              <input
                ref={inputRef}
                id="manager-chat-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                maxLength={500}
                placeholder="Type your request…"
                disabled={!ready || loading}
              />
              <button type="submit" disabled={!ready || loading || !input.trim()}>Send</button>
            </div>
            <small>Staff changes use secure forms and confirmation. AI never receives staff records or passwords.</small>
          </form>}
        </section>
      )}
    </div>
  );
}
