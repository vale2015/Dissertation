import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import StaffConversation from "./StaffConversation";

const member = { id: 42, full_name: "Alex Example", email: "alex@example.test", application_role: "staff", staff_role_id: 3, staff_role_name: "Server", status: "active" };
const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
let action;
let failConfirm;
let failPatch;
beforeEach(() => {
  sessionStorage.clear();
  action = null; failConfirm = null; failPatch = null;
  vi.stubGlobal("fetch", vi.fn(async (url, options = {}) => {
    const method = options.method || "GET";
    const body = options.body ? JSON.parse(options.body) : null;
    if (url.endsWith("/roles")) return response({ roles: [{ id: 3, role_name: "Server" }] });
    if (url.endsWith("/current")) return response({ action: ["draft", "review"].includes(action?.state) ? action : null });
    if (url.includes("chat-lookup")) return response({ matches: [member, { ...member, id: 43, email: "alex.other@example.test" }] });
    if (url.endsWith("/42")) return response({ staff: member });
    if (url.endsWith("/chat-actions") && method === "POST") { action = { id: "draft-id", revision: 1, state: "draft", kind: body.kind, target_user_id: body.target_user_id, draft: {} }; return response({ action }); }
    if (method === "PATCH") {
      if (failPatch) return response({ error: { message: "Enter a valid email address." } }, failPatch);
      action = { ...action, draft: { ...action.draft, ...body }, revision: action.revision + 1, state: "draft" }; return response({ action });
    }
    if (url.endsWith("/review")) { action = { ...action, state: "review", revision: action.revision + 1, before: action.kind === "edit" ? member : null, after: { ...(action.kind === "edit" ? member : {}), ...action.draft, staff_role_name: "Server" } }; return response({ action }); }
    if (url.endsWith("/confirm")) {
      if (failConfirm === 409 || failConfirm === 403) return response({ error: { message: "This draft changed or expired." } }, failConfirm);
      action = { ...action, state: "completed", result: { ...action.after, id: 42 } };
      if (failConfirm === "lost") throw new TypeError("connection lost");
      return response({ staff: action.result, replayed: false });
    }
    if (method === "DELETE") { action = null; return response({ cancelled: true }); }
    return response({ action });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function registerToReview() {
  const user = userEvent.setup();
  render(<StaffConversation command={{ kind: "register" }} actorId={7} onExit={vi.fn()} onOtherControls={vi.fn()} />);
  await user.type(await screen.findByRole("textbox", { name: "Full name" }), "Alex Example");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.type(await screen.findByRole("textbox", { name: "Email" }), "alex@example.test");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(await screen.findByRole("button", { name: "Staff", exact: true }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Server", exact: true })).toHaveFocus());
  await user.click(await screen.findByRole("button", { name: "Server", exact: true }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Review change" })).toHaveFocus());
  await user.click(await screen.findByRole("button", { name: "Review change" }));
  await screen.findByLabelText("Password", { exact: true });
  return user;
}

test("registers through server drafts and explicit review; secrets only enter final secure request", async () => {
  const user = await registerToReview();
  const password = screen.getByLabelText("Password", { exact: true });
  await waitFor(() => expect(password).toHaveFocus());
  expect(password).toHaveAttribute("type", "password");
  expect(screen.getByRole("button", { name: "Create staff account" })).toBeDisabled();
  await user.type(password, "a secure password");
  await user.tab();
  expect(screen.getByLabelText("Confirm password")).toHaveFocus();
  await user.type(screen.getByLabelText("Confirm password"), "a secure password");
  expect(fetch.mock.calls.some(([, opts]) => opts.body?.includes("password"))).toBe(false);
  expect(sessionStorage.getItem("rfs-staff-action:7")).not.toMatch(/Alex|example|password/);
  await user.click(screen.getByRole("button", { name: "Create staff account" }));
  await screen.findByText("The account change is confirmed and verified.");
  const writes = fetch.mock.calls.filter(([url]) => url.endsWith("/confirm"));
  expect(writes).toHaveLength(1);
  expect(JSON.parse(writes[0][1].body)).toEqual({ confirm: true, revision: 6, password: "a secure password", password_confirmation: "a secure password" });
  expect(screen.queryByLabelText("Password", { exact: true })).not.toBeInTheDocument();
});

test("edit matches require an exact account selection and show before/after target", async () => {
  const user = userEvent.setup();
  render(<StaffConversation command={{ kind: "edit", query: "Alex" }} actorId={7} onExit={vi.fn()} />);
  await screen.findByRole("button", { name: /alex.other@example.test/ });
  await waitFor(() => expect(screen.getByRole("button", { name: /alex@example.test/ })).toHaveFocus());
  expect(fetch.mock.calls.some(([url, opts]) => url.endsWith("/chat-actions") && opts.method === "POST")).toBe(false);
  await user.click(screen.getByRole("button", { name: /alex@example.test/ }));
  await waitFor(() => expect(screen.getByText("Edit details")).toHaveFocus());
  await user.click(screen.getByText("Edit details"));
  await user.click(await screen.findByRole("button", { name: "Change full name" }));
  await user.type(screen.getByRole("textbox", { name: "Full name" }), "Alex Corrected");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(await screen.findByRole("button", { name: "Review change" }));
  await screen.findByRole("heading", { name: "After" });
  await waitFor(() => expect(screen.getByRole("button", { name: "Save account changes" })).toHaveFocus());
  expect(screen.getByText("Alex Corrected")).toBeInTheDocument();
  expect(screen.getAllByText("alex@example.test").length).toBeGreaterThan(0);
  expect(screen.queryByLabelText("Password", { exact: true })).not.toBeInTheDocument();
  expect(fetch.mock.calls.some(([url]) => url.endsWith("/confirm"))).toBe(false);
});

test("stale confirmation clears passwords and blocks retry until authoritative reload", async () => {
  const user = await registerToReview(); failConfirm = 409;
  await user.type(screen.getByLabelText("Password", { exact: true }), "a secure password");
  await user.type(screen.getByLabelText("Confirm password"), "a secure password");
  await user.click(screen.getByRole("button", { name: "Create staff account" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("changed or expired");
  expect(screen.getByLabelText("Password", { exact: true })).toHaveValue("");
  expect(screen.getByRole("button", { name: "Create staff account" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Reload draft" }));
  expect(fetch.mock.calls.filter(([url]) => url.endsWith("/confirm"))).toHaveLength(1);
});

test("lost confirmation response resolves the saved receipt without password replay", async () => {
  const user = await registerToReview(); failConfirm = "lost";
  await user.type(screen.getByLabelText("Password", { exact: true }), "a secure password");
  await user.type(screen.getByLabelText("Confirm password"), "a secure password");
  await user.click(screen.getByRole("button", { name: "Create staff account" }));
  await screen.findByText("The account change is confirmed and verified.");
  expect(fetch.mock.calls.filter(([url]) => url.endsWith("/confirm"))).toHaveLength(1);
});

test("cancel deletes only the draft and never confirms; validation stays on the same field", async () => {
  const user = userEvent.setup(); const exit = vi.fn();
  render(<StaffConversation command={{ kind: "register" }} actorId={7} onExit={exit} />);
  await user.type(await screen.findByRole("textbox", { name: "Full name" }), "Alex Example");
  failPatch = 400;
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("valid email");
  expect(screen.getByRole("textbox", { name: "Full name" })).toHaveValue("Alex Example");
  await user.click(screen.getByRole("button", { name: "Cancel staff change" }));
  await waitFor(() => expect(exit).toHaveBeenCalledOnce());
  expect(fetch.mock.calls.filter(([, options]) => options.method === "DELETE")).toHaveLength(1);
  expect(fetch.mock.calls.some(([url]) => url.endsWith("/confirm"))).toBe(false);
  expect(sessionStorage.getItem("rfs-staff-action:7")).toBeNull();
});

test("manager denial never reports success", async () => {
  const user = await registerToReview(); failConfirm = 403;
  await user.type(screen.getByLabelText("Password", { exact: true }), "a secure password");
  await user.type(screen.getByLabelText("Confirm password"), "a secure password");
  await user.click(screen.getByRole("button", { name: "Create staff account" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Manager permission is required");
  expect(screen.queryByText("The account change is confirmed and verified.")).not.toBeInTheDocument();
});

test("a completed receipt is recovered from a per-actor ID pointer without another write", async () => {
  action = { id: "receipt-id", kind: "register", state: "completed", result: member, revision: 6 };
  sessionStorage.setItem("rfs-staff-action:7", JSON.stringify({ id: "receipt-id", revision: 6 }));
  render(<StaffConversation command={{ kind: "register" }} actorId={7} onExit={vi.fn()} />);
  await screen.findByText("The account change is confirmed and verified.");
  await waitFor(() => expect(screen.getByRole("button", { name: "Finish" })).toHaveFocus());
  expect(screen.getByText("alex@example.test")).toBeInTheDocument();
  expect(fetch.mock.calls.every(([, options]) => options.method === "GET")).toBe(true);
});

test("private choices receive focus and Edit moves focus into the new prompt without trapping Tab", async () => {
  const user = userEvent.setup();
  render(<><StaffConversation command={{ kind: "choose" }} actorId={7} onExit={vi.fn()} /><button type="button">Outside conversation</button></>);
  const register = await screen.findByRole("button", { name: "Register a staff member" });
  await waitFor(() => expect(register).toHaveFocus());
  await user.tab();
  expect(screen.getByRole("button", { name: "Edit a staff member" })).toHaveFocus();
  await user.keyboard("{Enter}");
  await waitFor(() => expect(screen.getByRole("textbox", { name: /Whose account should I edit/ })).toHaveFocus());
  await user.tab();
  expect(screen.getByRole("button", { name: "Cancel staff change" })).toHaveFocus();
  await user.tab();
  expect(screen.getByRole("button", { name: "Other staff controls" })).toHaveFocus();
  await user.tab();
  expect(screen.getByRole("button", { name: "Outside conversation" })).toHaveFocus();
});

test("manager registration allows an explicitly unassigned restaurant role", async () => {
  const user = userEvent.setup();
  action = { id: "draft-id", kind: "register", state: "draft", revision: 3, draft: { full_name: "Alex", email: "alex@example.test", application_role: "manager" } };
  render(<StaffConversation command={{ kind: "register" }} actorId={7} onExit={vi.fn()} />);
  await user.click(await screen.findByRole("button", { name: "Not assigned", exact: true }));
  expect(await screen.findByRole("button", { name: "Review change" })).toBeEnabled();
  expect(action.draft.staff_role_id).toBeNull();
});

test.each(["register", "edit"])("%s preserves names above 100 characters through the 120-character boundary", async (kind) => {
  const user = userEvent.setup();
  if (kind === "edit") action = { id: "draft-id", kind, state: "draft", revision: 1, target_user_id: member.id, draft: {} };
  render(<StaffConversation command={{ kind }} actorId={7} onExit={vi.fn()} />);
  if (kind === "edit") { await screen.findByText("Edit details"); await user.click(screen.getByText("Edit details")); await user.click(screen.getByRole("button", { name: "Change full name" })); }

  const name101 = "A".repeat(101);
  await user.type(await screen.findByRole("textbox", { name: "Full name" }), name101);
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await waitFor(() => expect(action.draft.full_name).toBe(name101));

  if (!screen.getByText("Edit details").parentElement.open) await user.click(screen.getByText("Edit details"));
  await user.click(screen.getByRole("button", { name: "Change full name" }));
  const input = screen.getByRole("textbox", { name: "Full name" });
  const name120 = "B".repeat(120);
  expect(input).toHaveAttribute("maxlength", "120");
  await user.type(input, `${name120}Z`);
  expect(input).toHaveValue(name120);
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await waitFor(() => expect(action.draft.full_name).toBe(name120));
  const namePatches = fetch.mock.calls.filter(([, options]) => options.method === "PATCH").map(([, options]) => JSON.parse(options.body));
  expect(namePatches).toEqual([{ full_name: name101 }, { full_name: name120 }]);
});


test("registration review has one authoritative summary and named role fields", async () => {
  await registerToReview();
  expect(screen.getByRole("heading", { name: "Account details" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Registration draft" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "After" })).not.toBeInTheDocument();
  expect(screen.getAllByText("Alex Example")).toHaveLength(1);
  expect(screen.getByText("System access")).toBeInTheDocument();
  expect(screen.getByText("Job role")).toBeInTheDocument();
  expect(screen.getByText("Staff", { exact: true })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Other staff controls" })).not.toBeInTheDocument();
  expect(screen.getByText("Edit details").parentElement).not.toHaveAttribute("open");
});

test("password feedback covers missing, short, whitespace and mismatch with optional visibility", async () => {
  const user = await registerToReview();
  const password = screen.getByLabelText("Password", { exact: true });
  const confirmation = screen.getByLabelText("Confirm password");
  const submit = screen.getByRole("button", { name: "Create staff account" });
  expect(screen.getByText("Enter a password.")).toHaveAttribute("aria-live", "polite");
  expect(password).toHaveAttribute("aria-describedby", "staff-password-rule staff-password-feedback");
  expect(password).toHaveAttribute("aria-invalid", "true");
  await user.type(password, "short");
  expect(screen.getByText("Password needs at least 12 characters.")).toBeInTheDocument();
  await user.clear(password); await user.type(password, "            ");
  expect(screen.getByText("Password cannot contain only whitespace.")).toBeInTheDocument();
  await user.type(confirmation, "            "); expect(submit).toBeDisabled();
  await user.clear(password); await user.type(password, "a secure password");
  expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
  expect(confirmation).toHaveAttribute("aria-invalid", "true");
  await user.clear(confirmation); await user.type(confirmation, "a secure password");
  expect(password).toHaveAttribute("aria-invalid", "false"); expect(submit).toBeEnabled();
  await user.tab(); expect(screen.getByRole("checkbox", { name: "Show passwords" })).toHaveFocus();
  await user.keyboard(" ");
  expect(password).toHaveAttribute("type", "text"); expect(confirmation).toHaveAttribute("type", "text");
  await user.click(screen.getByRole("checkbox", { name: "Show passwords" }));
  expect(password).toHaveAttribute("type", "password");
  expect(fetch.mock.calls.some(([, options]) => options.body?.includes("password"))).toBe(false);
});

test("correcting review clears passwords and focuses a visible field", async () => {
  const user = await registerToReview();
  await user.type(screen.getByLabelText("Password", { exact: true }), "a secure password");
  await user.type(screen.getByLabelText("Confirm password"), "a secure password");
  await user.click(screen.getByRole("checkbox", { name: "Show passwords" }));
  await user.click(screen.getByText("Edit details"));
  await user.click(screen.getByRole("button", { name: "Change full name" }));
  const name = screen.getByRole("textbox", { name: "Full name" });
  await waitFor(() => expect(name).toHaveFocus());
  expect(screen.queryByLabelText("Password", { exact: true })).not.toBeInTheDocument();
  await user.type(name, "Alex Corrected"); await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(screen.getByRole("button", { name: "Review change" }));
  expect(screen.getByLabelText("Password", { exact: true })).toHaveValue("");
  expect(screen.getByLabelText("Confirm password")).toHaveValue("");
  expect(screen.getByRole("checkbox", { name: "Show passwords" })).not.toBeChecked();
  expect(screen.getByRole("button", { name: "Create staff account" })).toBeDisabled();
});

test("restored registration uses authoritative review values and fresh password capture", async () => {
  action = { id: "draft-id", kind: "register", state: "review", revision: 6, draft: { ...member, full_name: "Old draft name" }, after: member };
  render(<StaffConversation command={{ kind: "choose" }} actorId={7} onExit={vi.fn()} />);
  await screen.findByRole("heading", { name: "Account details" });
  expect(screen.getAllByText("Alex Example")).toHaveLength(1);
  expect(screen.queryByText("Old draft name")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Password", { exact: true })).toHaveValue("");
  expect(fetch.mock.calls.every(([, options]) => options.method === "GET")).toBe(true);
});
