import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, test, vi } from "vitest";
import LoginForm from "./loginForm";

afterEach(cleanup);

function renderForm(overrides = {}) {
  const props = {
    email: "",
    password: "",
    error: "",
    loading: false,
    showPassword: false,
    onEmailChange: vi.fn(),
    onPasswordChange: vi.fn(),
    onToggleShowPassword: vi.fn(),
    onSubmit: vi.fn((event) => event.preventDefault()),
    ...overrides,
  };
  render(<LoginForm {...props} />);
  return props;
}

test("sign-in controls remain labelled and submit through the existing handler", async () => {
  const user = userEvent.setup();
  const props = renderForm({ email: "manager@example.com", password: "demo-password" });
  expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Email" })).toHaveAttribute("autocomplete", "email");
  expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  await user.click(screen.getByRole("button", { name: "Show password" }));
  expect(props.onToggleShowPassword).toHaveBeenCalledOnce();
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  expect(props.onSubmit).toHaveBeenCalledOnce();
});

test("errors are announced and controls cannot be used during submission", () => {
  renderForm({ error: "Authentication service is temporarily unavailable.", loading: true });
  expect(screen.getByRole("alert")).toHaveTextContent("Authentication service is temporarily unavailable.");
  expect(screen.getByRole("textbox", { name: "Email" })).not.toHaveAttribute("aria-invalid");
  expect(screen.getByLabelText("Password")).toHaveAttribute("aria-describedby", "login-error");
  expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
});

test("demo credentials are available only after opening the disclosure", async () => {
  const user = userEvent.setup();
  renderForm();
  const disclosure = screen.getByText(/Exploring the demo/).closest("details");
  expect(disclosure).not.toHaveAttribute("open");
  await user.click(screen.getByText(/Exploring the demo/));
  expect(disclosure).toHaveAttribute("open");
  expect(screen.getByText("manager@example.com")).toBeInTheDocument();
});
