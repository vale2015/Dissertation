import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import Sidebar from "./sidebar";
import useSession from "@/hooks/useSession";

const navigation = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  router: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => navigation.router,
  useSearchParams: () => navigation.searchParams,
}));
vi.mock("@/hooks/useSession", () => ({ default: vi.fn() }));

beforeEach(() => {
  useSession.mockReturnValue({ user: { id: 7, role: "manager" } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ latest_record: { date: "2026-10-30" } }) }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

test("RFS AI launcher sits inside the sidebar after the navigation", () => {
  render(<Sidebar />);
  const navigationElement = screen.getByRole("navigation");
  const launcher = screen.getByRole("button", { name: "Open RFS assistant" });
  expect(launcher.closest(".sidebar")).toBeInTheDocument();
  expect(navigationElement.compareDocumentPosition(launcher) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
