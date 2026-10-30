import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, test, vi } from "vitest";
import NotificationBell from "./NotificationBell";

const notification = { id: 31, event_type: "report_saved", source_id: 31, title: "Management report saved", body: "Report #31 is ready.", created_at: "2026-10-30T10:00:00Z", read_at: null };

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

test("bell shows a real unread notification and marks it read", async () => {
  const fetchMock = vi.fn((url, options) => Promise.resolve(url.endsWith("/read")
    ? { ok: true, json: async () => ({ notification: { id: 31, read_at: "2026-10-30T10:01:00Z" } }) }
    : { ok: true, json: async () => ({ notifications: [notification], unread_count: 1 }) }));
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(<NotificationBell userId={7} />);
  const bell = await screen.findByRole("button", { name: "Notifications, 1 unread" });
  await user.click(bell);
  expect(await screen.findByText("Report #31 is ready.")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Mark as read" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument());
  expect(fetchMock).toHaveBeenCalledWith("/api/backend/notifications/31/read", expect.objectContaining({ method: "PATCH" }));
});

test("bell offers retry when the inbox fails", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { message: "Unavailable" } }) }));
  const user = userEvent.setup();
  render(<NotificationBell userId={7} />);
  await user.click(screen.getByRole("button", { name: "Notifications" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Unavailable");
  expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
});
