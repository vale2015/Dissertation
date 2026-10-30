import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, test, vi } from "vitest";
import SettingsPage from "./page";
import useSession from "@/hooks/useSession";

vi.mock("@/hooks/useSession", () => ({ default: vi.fn() }));
vi.mock("@/components/staff/UserProfile", () => ({ default: () => <div>Own profile form</div> }));
vi.mock("@/app/dashboard/staffing-rules/page", () => ({ default: () => <div>Staffing rules view</div> }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("personal settings are visible without staffing-rule permission", () => {
  useSession.mockReturnValue({ user: { permissions: ["view_own_profile"] } });
  render(<SettingsPage />);
  expect(screen.getByText("Own profile form")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Staffing rules" })).not.toBeInTheDocument();
});

test("authorized manager can open staffing rules inside Settings", async () => {
  useSession.mockReturnValue({ user: { permissions: ["view_own_profile", "manage_staffing_rules"] } });
  render(<SettingsPage />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Staffing rules" }));
  expect(screen.getByText("Staffing rules view")).toBeInTheDocument();
  expect(screen.queryByText("Own profile form")).not.toBeInTheDocument();
});
