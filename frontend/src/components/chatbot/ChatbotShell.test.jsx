import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import ChatbotShell from "./ChatbotShell";
import useSession from "@/hooks/useSession";
import { PERMISSIONS } from "@/lib/permissions";

vi.mock("@/hooks/useSession", () => ({ default: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ children, href, onClick }) => <a href={href} onClick={onClick}>{children}</a>,
}));

const manager = {
  id: 7,
  role: "manager",
  permissions: [PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_FORECASTS, PERMISSIONS.VIEW_REPORTS, PERMISSIONS.MANAGE_STAFF_ACCOUNTS],
};

beforeEach(() => {
  useSession.mockReturnValue({ user: manager });
  vi.stubGlobal("requestAnimationFrame", (callback) => setTimeout(callback, 0));
  vi.stubGlobal("cancelAnimationFrame", (id) => clearTimeout(id));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ phase: "skeleton", conversation_enabled: false, business_tools_enabled: false }),
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

test("non-managers do not see the launcher", () => {
  useSession.mockReturnValue({ user: { id: 9, role: "staff", permissions: [PERMISSIONS.VIEW_OWN_PROFILE] } });
  render(<ChatbotShell />);
  expect(screen.queryByRole("button", { name: "Open RFS assistant" })).not.toBeInTheDocument();
});

test("manager opens the preview, cannot send, and Escape restores focus", async () => {
  const user = userEvent.setup();
  render(<ChatbotShell />);
  const launcher = screen.getByRole("button", { name: "Open RFS assistant" });

  await user.click(launcher);
  expect(screen.getByRole("dialog", { name: "Ask RFS" })).toBeInTheDocument();
  expect(await screen.findByText("Your service, in focus.")).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Message" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  expect(fetch).toHaveBeenCalledWith("/api/chatbot", expect.objectContaining({ cache: "no-store" }));
  expect(screen.getByRole("button", { name: "Close assistant" })).toHaveFocus();

  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(launcher).toHaveFocus();
});

test("availability failure is visible and retryable", async () => {
  fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Assistant temporarily unavailable." }) });
  const user = userEvent.setup();
  render(<ChatbotShell />);
  await user.click(screen.getByRole("button", { name: "Open RFS assistant" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Assistant temporarily unavailable.");
  await user.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("Your service, in focus.")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(2);
});

test("shortcut links follow the authenticated manager's permissions", async () => {
  useSession.mockReturnValue({ user: { ...manager, permissions: [PERMISSIONS.VIEW_REPORTS] } });
  const user = userEvent.setup();
  render(<ChatbotShell />);
  await user.click(screen.getByRole("button", { name: "Open RFS assistant" }));
  expect(await screen.findByRole("link", { name: /Reports/ })).toHaveAttribute("href", "/dashboard/reports");
  expect(screen.queryByRole("link", { name: /Staff/ })).not.toBeInTheDocument();
});
