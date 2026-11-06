import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import Sidebar from "./sidebar";
import useSession from "@/hooks/useSession";
import { PERMISSIONS } from "@/lib/permissions";

const navigation = vi.hoisted(() => ({
  pathname: "/dashboard",
  searchParams: new URLSearchParams(),
  router: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => navigation.router,
  useSearchParams: () => navigation.searchParams,
}));
vi.mock("@/hooks/useSession", () => ({ default: vi.fn() }));

beforeEach(() => {
  navigation.pathname = "/dashboard";
  navigation.searchParams = new URLSearchParams();
  useSession.mockReturnValue({ user: { id: 7, role: "manager", permissions: Object.values(PERMISSIONS) } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ latest_record: { date: "2026-10-30" } }) }));
});

test("forecast navigation uses the latest historical day when dashboard selection is in the future", async () => {
  navigation.searchParams = new URLSearchParams("date=2026-11-30");
  render(<Sidebar today="2026-11-05" />);
  await waitFor(() => expect(screen.getByRole("link", { name: "Reservation Forecast" })).toHaveAttribute("href", "/dashboard/reservation-forecast?date=2026-10-30"));
});

test("forecast navigation preserves a valid historical base day", async () => {
  navigation.searchParams = new URLSearchParams("date=2026-10-25");
  render(<Sidebar today="2026-11-05" />);
  await waitFor(() => expect(screen.getByRole("link", { name: "Reservation Forecast" })).toHaveAttribute("href", "/dashboard/reservation-forecast?date=2026-10-25"));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

test("dashboard calendar sits below Settings and above the unchanged RFS AI launcher", () => {
  render(<Sidebar today="2026-11-05" />);
  const navigationElement = screen.getByRole("navigation");
  const settings = screen.getByRole("link", { name: "Settings" });
  const calendar = screen.getByRole("button", { name: /View a day/ });
  const launcher = screen.getByRole("button", { name: "Open RFS assistant" });
  expect(calendar).toHaveTextContent("Thu, 5 Nov 2026");
  expect(settings.compareDocumentPosition(calendar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(calendar.compareDocumentPosition(launcher) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(launcher.closest(".sidebar")).toBeInTheDocument();
  expect(navigationElement.compareDocumentPosition(launcher) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test("choosing a day in the sidebar opens the dashboard day view", () => {
  render(<Sidebar today="2026-11-05" />);
  fireEvent.click(screen.getByRole("button", { name: /View a day/ }));
  const day = document.querySelector(".rfs-dashboard-calendar .react-datepicker__day--004:not(.react-datepicker__day--outside-month)");
  expect(day).not.toBeNull();
  fireEvent.click(day);
  expect(navigation.router.push).toHaveBeenCalledWith("/dashboard?date=2026-11-04");
});

test("the sidebar calendar opens with the keyboard and selected days can return to overview", async () => {
  navigation.searchParams = new URLSearchParams("date=2026-11-30");
  const user = userEvent.setup();
  render(<Sidebar today="2026-11-05" />);
  const calendar = screen.getByRole("button", { name: /View a day/ });
  expect(calendar).toHaveTextContent("Mon, 30 Nov 2026");
  calendar.focus();
  await user.keyboard("{Enter}");
  expect(document.querySelector(".rfs-dashboard-calendar")).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Show overview" }));
  expect(navigation.router.push).toHaveBeenCalledWith("/dashboard");
});

test("an impossible dashboard URL date falls back to today and clears the bad selection", () => {
  navigation.searchParams = new URLSearchParams("date=2026-02-31");
  render(<Sidebar today="2026-11-05" />);
  expect(screen.getByRole("button", { name: /View a day/ })).toHaveTextContent("Thu, 5 Nov 2026");
  expect(navigation.router.replace).toHaveBeenCalledWith("/dashboard");
});
