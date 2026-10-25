import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import StaffManagement from "./StaffManagement";
import useStaff from "@/hooks/useStaff";

vi.mock("@/hooks/useStaff", () => ({ default: vi.fn() }));

const member = { id: 3, full_name: "Alex Example", email: "alex@example.com", role: "staff", status: "active", staff_role_name: null };
let api;

beforeEach(() => {
  api = { staff: [member], roles: [], loading: false, error: "", register: vi.fn().mockResolvedValue({}), update: vi.fn().mockResolvedValue({}), status: vi.fn().mockResolvedValue({}), reset: vi.fn().mockResolvedValue({ reset_link: "https://example.test/reset", expires_at: "2026-11-01T12:00:00Z" }) };
  useStaff.mockReturnValue(api);
});

afterEach(() => { cleanup(); vi.clearAllMocks(); });

test("registration requires a separate review before the protected write", async () => {
  const user = userEvent.setup();
  render(<StaffManagement />);
  await user.click(screen.getByRole("button", { name: "Register staff member" }));
  await user.type(screen.getByLabelText("Full name"), "Jamie Example");
  await user.type(screen.getByLabelText("Email"), "jamie@example.com");
  await user.type(screen.getByLabelText("Initial password"), "a-long-private-password");
  await user.type(screen.getByLabelText("Confirm password"), "a-long-private-password");
  await user.click(screen.getByRole("button", { name: "Review registration" }));
  expect(api.register).not.toHaveBeenCalled();
  expect(screen.getByText(/jamie@example.com/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Confirm registration" }));
  expect(api.register).toHaveBeenCalledTimes(1);
});

test("password reset requires confirmation for the named account", async () => {
  const user = userEvent.setup();
  render(<StaffManagement />);
  await user.click(screen.getByRole("button", { name: "Reset password" }));
  expect(api.reset).not.toHaveBeenCalled();
  expect(screen.getByText(/Generate a one-time password-reset link for Alex Example/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Generate reset link" }));
  expect(api.reset).toHaveBeenCalledTimes(1);
});
