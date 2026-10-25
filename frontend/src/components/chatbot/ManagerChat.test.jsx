import { cleanup, render, screen } from "@testing-library/react";
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

test("manager sees typed chat in the header, weather on open, and no shortcut blocks", async () => {
  const user = userEvent.setup();
  render(<ManagerChat />);
  const launcher = screen.getByRole("button", { name: "Open RFS assistant" });
  await user.click(launcher);
  expect(await screen.findByText("London: 11°C and cloudy.")).toBeInTheDocument();
  expect(screen.getByText(/Hi, I can check the weather/)).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Your message" })).toBeEnabled();
  expect(screen.queryByRole("navigation", { name: /shortcuts/i })).not.toBeInTheDocument();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(launcher).toHaveFocus();
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

test("restricted roles never see the launcher", () => {
  useSession.mockReturnValue({ user: { id: 9, role: "staff" } });
  render(<ManagerChat />);
  expect(screen.queryByRole("button", { name: "Open RFS assistant" })).not.toBeInTheDocument();
});
