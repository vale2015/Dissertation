import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import ManagerChat from "./ManagerChat";
import useSession from "@/hooks/useSession";

vi.mock("@/hooks/useSession", () => ({ default: vi.fn() }));
vi.mock("@/components/staff/StaffManagement", () => ({ default: () => <div>Secure staff workspace</div> }));
vi.mock("@/lib/report-download", () => ({ downloadManagementReport: vi.fn(), downloadSavedReport: vi.fn() }));

beforeEach(() => {
  useSession.mockReturnValue({ user: { id: 7, role: "manager" } });
  vi.stubGlobal("requestAnimationFrame", (callback) => setTimeout(callback, 0));
  vi.stubGlobal("cancelAnimationFrame", (id) => clearTimeout(id));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ conversation_enabled: true, model_enabled: false, weather: { text: "London: 11°C and cloudy." } }),
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

test("manager sees branded chat, weather on open, and suggested requests only prefill", async () => {
  const user = userEvent.setup();
  render(<ManagerChat />);
  const launcher = screen.getByRole("button", { name: "Open RFS assistant" });
  await user.click(launcher);
  expect(await screen.findByText("London: 11°C and cloudy.")).toBeInTheDocument();
  expect(screen.getByText(/Hi there! I’m your RFS Assistant/)).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Your message" })).toBeEnabled();
  await user.click(screen.getByRole("button", { name: "Generate a report" }));
  expect(screen.getByRole("textbox", { name: "Your message" })).toHaveValue("Generate a report");
  expect(screen.getByRole("button", { name: "Check today's bookings" })).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(1);
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(launcher).toHaveFocus();
  await user.click(launcher);
  await screen.findByRole("dialog");
  expect(screen.getAllByText("London: 11°C and cloudy.")).toHaveLength(1);
  expect(fetch).toHaveBeenCalledTimes(2);
});

test("typed request stays in chat and opens staff workspace without navigation", async () => {
  const user = userEvent.setup();
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ conversation_enabled: true, weather: { text: "Weather ready." } }) });
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ text: "I can manage staff here.", workspace: "staff" }) });
  render(<ManagerChat />);
  await user.click(screen.getByRole("button", { name: "Open RFS assistant" }));
  await screen.findByText("Weather ready.");
  await user.type(screen.getByRole("textbox", { name: "Your message" }), "manage staff");
  await user.click(screen.getByRole("button", { name: "Send" }));
  expect(await screen.findByText("Secure staff workspace")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/api/chatbot", expect.objectContaining({ method: "POST", body: JSON.stringify({ message: "manage staff" }) }));
});

test("an undated report opens an in-chat calendar and choosing a date generates that report", async () => {
  const user = userEvent.setup();
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ conversation_enabled: true, weather: { text: "Weather ready." } }) });
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ text: "Choose a date in the calendar below.", date_picker: { intent: "report", days: 7, format: null } }) });
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ text: "Report generated for selected day", report_ref: { selected_date: "2026-11-01", days_ahead: 7 } }) });
  render(<ManagerChat />);
  await user.click(screen.getByRole("button", { name: "Open RFS assistant" }));
  await screen.findByText("Weather ready.");
  await user.type(screen.getByRole("textbox", { name: "Your message" }), "generate me a report");
  await user.click(screen.getByRole("button", { name: "Send" }));
  const calendar = await screen.findByRole("group", { name: "Choose a report date" });
  await waitFor(() => expect(calendar).toHaveFocus());
  await user.tab();
  expect(calendar).toContainElement(document.activeElement);
  const day = document.querySelector(".manager-chat-calendar .react-datepicker__day--001:not(.react-datepicker__day--outside-month)");
  expect(day).not.toBeNull();
  fireEvent.click(day);
  expect(await screen.findByText("Report generated for selected day")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("textbox", { name: "Your message" })).toHaveFocus());
  expect(screen.queryByRole("group", { name: "Choose a report date" })).not.toBeInTheDocument();
  const request = JSON.parse(fetch.mock.calls.at(-1)[1].body);
  expect(request.message).toMatch(/^generate a 7-day report for \d{4}-\d{2}-01$/);
});

test("calendar controls remain present at a 320px viewport", async () => {
  vi.stubGlobal("innerWidth", 320);
  const user = userEvent.setup();
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ conversation_enabled: true, weather: { text: "Weather ready." } }) });
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ text: "Choose a date.", date_picker: { intent: "report", days: 7, format: null } }) });
  render(<ManagerChat />);
  await user.click(screen.getByRole("button", { name: "Open RFS assistant" }));
  await screen.findByText("Weather ready.");
  await user.type(screen.getByRole("textbox", { name: "Your message" }), "generate a report");
  await user.click(screen.getByRole("button", { name: "Send" }));
  const calendar = await screen.findByRole("group", { name: "Choose a report date" });
  expect(calendar.querySelectorAll("select")).toHaveLength(2);
  expect(calendar.querySelector(".react-datepicker__day--001:not(.react-datepicker__day--outside-month)")).not.toBeNull();
});

test("calendar selection preserves an explicitly requested 10-day report horizon", async () => {
  const user = userEvent.setup();
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ conversation_enabled: true, weather: { text: "Weather ready." } }) });
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ text: "Choose a date.", date_picker: { intent: "report", days: 10, format: null } }) });
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ text: "Ten-day report ready", report_ref: { selected_date: "2026-11-01", days_ahead: 10 } }) });
  render(<ManagerChat />);
  await user.click(screen.getByRole("button", { name: "Open RFS assistant" }));
  await screen.findByText("Weather ready.");
  await user.type(screen.getByRole("textbox", { name: "Your message" }), "generate a 10-day report");
  await user.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByRole("group", { name: "Choose a report date" });
  const day = document.querySelector(".manager-chat-calendar .react-datepicker__day--001:not(.react-datepicker__day--outside-month)");
  expect(day).not.toBeNull();
  fireEvent.click(day);
  expect(await screen.findByText("Ten-day report ready")).toBeInTheDocument();
  expect(JSON.parse(fetch.mock.calls.at(-1)[1].body).message).toMatch(/^generate a 10-day report for \d{4}-\d{2}-01$/);
});

test("a typed date after the report prompt uses the report route without AI", async () => {
  const user = userEvent.setup();
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ conversation_enabled: true, weather: { text: "Weather ready." } }) });
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ text: "Choose a date in the calendar below.", date_picker: { intent: "report", days: 10, format: null } }) });
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ text: "Report for 2026-06-15", report_ref: { selected_date: "2026-06-15", days_ahead: 10 } }) });
  render(<ManagerChat />);
  await user.click(screen.getByRole("button", { name: "Open RFS assistant" }));
  await screen.findByText("Weather ready.");
  const composer = screen.getByRole("textbox", { name: "Your message" });
  await user.type(composer, "generate a 10-day report");
  await user.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByRole("group", { name: "Choose a report date" });
  await user.type(composer, "2026-06-15");
  await user.click(screen.getByRole("button", { name: "Send" }));
  expect(await screen.findByText("Report for 2026-06-15")).toBeInTheDocument();
  expect(JSON.parse(fetch.mock.calls.at(-1)[1].body)).toEqual({ message: "generate a 10-day report for 2026-06-15" });
});

test("New chat dismisses a pending report calendar without generating anything", async () => {
  const user = userEvent.setup();
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ conversation_enabled: true, weather: { text: "Weather ready." } }) });
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ text: "Choose a date.", date_picker: { intent: "report", days: 7, format: null } }) });
  render(<ManagerChat />);
  await user.click(screen.getByRole("button", { name: "Open RFS assistant" }));
  await screen.findByText("Weather ready.");
  await user.type(screen.getByRole("textbox", { name: "Your message" }), "generate a report");
  await user.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByRole("group", { name: "Choose a report date" });
  await user.click(screen.getByRole("button", { name: "New chat" }));
  expect(screen.queryByRole("group", { name: "Choose a report date" })).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(2);
});

test("typed fresh-chat command clears transcript, staff workspace and report follow-up context", async () => {
  const user = userEvent.setup();
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ conversation_enabled: true, weather: { text: "Weather ready." } }) });
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ text: "Generated report #8", report_ref: { selected_date: "2026-11-29", days_ahead: 7, id: 8 } }) });
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ text: "Staff accounts ready.", workspace: "staff" }) });
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ reset: true }) });
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ text: "Which report date?" }) });
  render(<ManagerChat />);
  await user.click(screen.getByRole("button", { name: "Open RFS assistant" }));
  await screen.findByText("Weather ready.");
  const composer = screen.getByRole("textbox", { name: "Your message" });
  await user.type(composer, "report for 2026-11-29");
  await user.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("Generated report #8");
  await user.type(composer, "manage staff");
  await user.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("Secure staff workspace");
  await user.type(composer, "start a brand new chat");
  await user.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(screen.queryByText("Secure staff workspace")).not.toBeInTheDocument());
  expect(screen.queryByText("Generated report #8")).not.toBeInTheDocument();
  expect(screen.queryByText("Weather ready.")).not.toBeInTheDocument();
  expect(screen.queryByText("start a brand new chat")).not.toBeInTheDocument();
  expect(composer).toHaveValue("");
  await waitFor(() => expect(composer).toHaveFocus());
  await user.type(composer, "save it");
  await user.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("Which report date?");
  expect(JSON.parse(fetch.mock.calls.at(-1)[1].body)).toEqual({ message: "save it" });
});

test("New chat button resets locally and returns keyboard focus to the composer", async () => {
  const user = userEvent.setup();
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ conversation_enabled: true, weather: { text: "Weather ready." } }) });
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ text: "I can manage staff here.", workspace: "staff" }) });
  render(<ManagerChat />);
  await user.click(screen.getByRole("button", { name: "Open RFS assistant" }));
  await screen.findByText("Weather ready.");
  const composer = screen.getByRole("textbox", { name: "Your message" });
  await user.type(composer, "manage staff");
  await user.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByText("Secure staff workspace");
  const reset = screen.getByRole("button", { name: "New chat" });
  await user.click(reset);
  expect(screen.queryByText("Secure staff workspace")).not.toBeInTheDocument();
  expect(screen.queryByText("manage staff")).not.toBeInTheDocument();
  await waitFor(() => expect(composer).toHaveFocus());
  expect(fetch).toHaveBeenCalledTimes(2);
});

test("restricted roles never see the launcher", () => {
  useSession.mockReturnValue({ user: { id: 9, role: "staff" } });
  render(<ManagerChat />);
  expect(screen.queryByRole("button", { name: "Open RFS assistant" })).not.toBeInTheDocument();
});
