"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { nextStaffField, STAFF_FIELDS } from "@/lib/chatbot-staff.mjs";

async function request(path, method = "GET", body) {
  const response = await fetch(`/api/backend/staff${path}`, { method, cache: "no-store", headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const details = data?.error?.fields;
    const duplicate = data?.error?.code === "DUPLICATE_EMAIL";
    const message = response.status === 409 ? duplicate ? "An account already uses this email address. Change the email and review again." : `${data?.error?.message || "This draft changed or expired."} Reload the draft before confirming.` : response.status === 403 ? "Manager permission is required. No change was made." : response.status === 429 ? "Too many requests. Please wait before trying again." : typeof data?.error?.message === "string" ? data.error.message : "The staff service is unavailable. No change has been confirmed.";
    const error = new Error(message + (details && typeof details === "object" ? ` ${Object.values(details).filter((value) => typeof value === "string").join(" ")}` : ""));
    error.status = response.status;
    error.stale = response.status === 409 && !duplicate;
    throw error;
  }
  return data;
}

const FIELD_LABELS = { ...STAFF_FIELDS, application_role: "System access", staff_role_id: "Job role" };
const accessLabel = (value) => ({ staff: "Staff", supervisor: "Supervisor", manager: "Manager" })[value] || value;

function Snapshot({ value, title }) {
  if (!value) return null;
  return <div><h4>{title}</h4><dl>{[["Account", value.id], ["Name", value.full_name], ["Email", value.email], ["System access", accessLabel(value.application_role || value.role)], ["Job role", value.staff_role_name || (value.staff_role_id == null ? "Not assigned" : `Role #${value.staff_role_id}`)], ["Status", value.status]].filter(([, v]) => v != null).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></div>;
}

const StaffConversation = forwardRef(function StaffConversation({ command, actorId, onOtherControls, onExit, onBusyChange }, ref) {
  const [action, setAction] = useState(null);
  const [target, setTarget] = useState(null);
  const [roles, setRoles] = useState([]);
  const [matches, setMatches] = useState(null);
  const [field, setField] = useState(null);
  const [input, setInput] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState(null);
  const [stale, setStale] = useState(false);
  const [mode, setMode] = useState(command.kind);
  const inputRef = useRef(null);
  const passwordRef = useRef(null);
  const choicesRef = useRef(null);
  const roleChoicesRef = useRef(null);
  const matchesRef = useRef(null);
  const editFieldsRef = useRef(null);
  const reviewRef = useRef(null);
  const confirmRef = useRef(null);
  const finishRef = useRef(null);
  const reloadRef = useRef(null);
  const actionRef = useRef(null);
  const pointerKey = `rfs-staff-action:${actorId}`;

  function remember(next) {
    actionRef.current = next;
    setAction(next);
    if (next) sessionStorage.setItem(pointerKey, JSON.stringify({ id: next.id, revision: next.revision }));
    else sessionStorage.removeItem(pointerKey);
  }

  async function run(task) {
    setBusy(true); setNotice("");
    try { await task(); }
    catch (error) { setNotice(error.message); if (error.stale) setStale(true); }
    finally { setBusy(false); }
  }

  async function cancel() {
    setPassword(""); setConfirmation(""); setShowPasswords(false); setInput("");
    if (busy) throw new Error("Wait for the current staff request before cancelling.");
    if (actionRef.current && ["draft", "review"].includes(actionRef.current.state)) await request(`/chat-actions/${actionRef.current.id}`, "DELETE");
    remember(null); setMatches(null); setResult(null); setField(null); setTarget(null);
  }
  useImperativeHandle(ref, () => ({ cancel }));
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);

  async function lookup(query) {
    if (query.length < 2 || query.length > 80) { setNotice("Enter 2 to 80 characters of the name or email."); return; }
    const data = await request(`/chat-lookup?query=${encodeURIComponent(query)}`);
    setMatches(data.matches || []); setInput("");
    setNotice(data.more ? "More accounts match. Narrow the name or use the full email." : "Choose the exact account below. No account is selected automatically.");
  }

  async function restore() {
    const current = await request("/chat-actions/current");
    if (current.action) { remember(current.action); if (current.action.kind === "edit") setTarget((await request(`/${current.action.target_user_id}`)).staff); setStale(false); return true; }
    let pointer;
    try { pointer = JSON.parse(sessionStorage.getItem(pointerKey) || "null"); } catch { /* Only an action pointer is stored. */ }
    if (pointer?.id) {
      try {
        const saved = await request(`/chat-actions/${encodeURIComponent(pointer.id)}`);
        if (saved.action?.state === "completed" && saved.action.result) { remember(saved.action); setResult(saved.action.result); return true; }
      } catch { /* An expired/deleted pointer must not prevent starting again. */ }
    }
    remember(null); setStale(false); return false;
  }

  useEffect(() => {
    let alive = true;
    void run(async () => {
      const data = await request("/roles");
      if (!alive) return;
      setRoles(data.roles || []);
      if (await restore()) return;
      if (command.kind === "register") remember((await request("/chat-actions", "POST", { kind: "register" })).action);
      else if (command.kind === "edit" && command.query) await lookup(command.query);
    });
    return () => { alive = false; };
    // Starting/restoring is tied to this protected workspace instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeField = field || (action ? nextStaffField(action) : null);
  const focusStep = result ? "finish" : stale && !field ? "reload"
    : activeField ? (["full_name", "email"].includes(activeField) ? "input" : "roles")
      : action?.state === "review" ? (action.kind === "register" ? "password" : "confirm")
        : action ? (action.kind === "edit" && !Object.keys(action.draft || {}).length ? "fields" : "review")
          : matches?.length ? "matches" : mode === "edit" ? "input" : "choices";
  useEffect(() => {
    if (busy) return;
    const target = {
      input: inputRef.current,
      password: passwordRef.current,
      choices: choicesRef.current?.querySelector("button:not(:disabled)"),
      roles: roleChoicesRef.current?.querySelector("button:not(:disabled)"),
      matches: matchesRef.current?.querySelector("button:not(:disabled)"),
      fields: editFieldsRef.current?.querySelector("summary"),
      review: reviewRef.current,
      confirm: confirmRef.current,
      finish: finishRef.current,
      reload: reloadRef.current,
    }[focusStep];
    target?.focus();
  }, [busy, focusStep, activeField]);

  async function saveField(value) {
    if (!activeField || !action || busy) return;
    await run(async () => {
      const next = (await request(`/chat-actions/${action.id}`, "PATCH", { [activeField]: value })).action;
      remember(next); setStale(false); setInput(""); setField(null); setPassword(""); setConfirmation(""); setShowPasswords(false);
    });
  }

  async function confirm() {
    const secrets = action.kind === "register" ? { password, password_confirmation: confirmation } : {};
    setPassword(""); setConfirmation(""); setShowPasswords(false);
    await run(async () => {
      try {
        const data = await request(`/chat-actions/${action.id}/confirm`, "POST", { confirm: true, revision: action.revision, ...secrets });
        setResult(data.staff); remember({ ...action, state: "completed", result: data.staff });
      } catch (error) {
        // A lost response is resolved by reading its receipt, never replaying a password.
        const saved = await request(`/chat-actions/${action.id}`).catch(() => null);
        if (saved?.action?.state === "completed" && saved.action.result) { remember(saved.action); setResult(saved.action.result); }
        else throw error;
      }
    });
  }

  const passwordError = !password ? "Enter a password." : !password.trim() ? "Password cannot contain only whitespace." : password.length < 12 ? "Password needs at least 12 characters." : password.length > 128 ? "Password must be 128 characters or fewer." : "";
  const confirmationError = !confirmation ? "Enter the password again to confirm it." : password !== confirmation ? "Passwords do not match." : "";
  const finalLabel = action?.kind === "register" ? "Create staff account" : "Save account changes";

  return <section className="staff-conversation" aria-label="Private staff conversation">
    <h3>{action?.kind === "register" ? "Register a staff member" : "Manage staff"}</h3>
    <p>Private staff workspace · Drafts expire after 15 minutes.</p><details className="staff-privacy"><summary>How your details are protected</summary><p>Staff details and passwords stay out of AI and the general chat. Passwords are sent only when you create the account.</p></details>
    {busy && <p role="status">Checking staff details…</p>}
    {notice && <p role="alert">{notice}</p>}
    {stale && <button ref={reloadRef} type="button" disabled={busy} onClick={() => run(async () => { setPassword(""); setConfirmation(""); setShowPasswords(false); if (!await restore()) setMode("choose"); })}>Reload draft</button>}
    {result ? <><p role="status">The account change is confirmed and verified.</p><Snapshot title="Saved account" value={result} /><button ref={finishRef} type="button" onClick={() => { remember(null); onExit(); }}>Finish</button></> : <>
      {!action && mode === "choose" && <div ref={choicesRef}><p>What would you like to do?</p><button type="button" disabled={busy} onClick={() => run(async () => { setMode("register"); remember((await request("/chat-actions", "POST", { kind: "register" })).action); })}>Register a staff member</button><button type="button" disabled={busy} onClick={() => setMode("edit")}>Edit a staff member</button></div>}
      {!action && mode === "edit" && <form onSubmit={(event) => { event.preventDefault(); void run(() => lookup(input.trim())); }}><label htmlFor="staff-private-reply">Whose account should I edit? Enter a name or email.</label><input ref={inputRef} id="staff-private-reply" autoComplete="off" maxLength={80} value={input} onChange={(event) => setInput(event.target.value)} disabled={busy} /><button disabled={busy || input.trim().length < 2}>Find account</button></form>}
      {matches && <div ref={matchesRef} aria-label="Matching staff accounts">{matches.length === 0 && <p>No matching accounts. Try the full name or email.</p>}{matches.map((member) => <button key={member.id} type="button" disabled={busy} onClick={() => run(async () => { remember((await request("/chat-actions", "POST", { kind: "edit", target_user_id: member.id })).action); setTarget(member); setMatches(null); })}>{member.full_name} · {member.email} · #{member.id} · {member.status}</button>)}</div>}
      {action && <>
        {action.state !== "review" && <Snapshot title={action.kind === "edit" ? "Selected account" : "Registration draft"} value={action.before || target || { ...action.draft, staff_role_name: roles.find((role) => role.id === action.draft?.staff_role_id)?.role_name }} />}
        {activeField && <div ref={roleChoicesRef}><p>{FIELD_LABELS[activeField]}: {activeField === "application_role" ? "Choose what this person can access in RFS." : activeField === "staff_role_id" ? "Choose the work this person does in the restaurant. This does not change system permissions." : "Enter the value below. Do not enter a password here."}</p>
          {activeField === "application_role" ? ["staff", "supervisor", "manager"].map((role) => <button key={role} type="button" disabled={busy} onClick={() => saveField(role)}>{accessLabel(role)}</button>) : activeField === "staff_role_id" ? <>{roles.map((role) => <button key={role.id} type="button" disabled={busy} onClick={() => saveField(role.id)}>{role.role_name}</button>)}{(action.draft?.application_role || target?.application_role || action.before?.application_role) !== "staff" && <button type="button" disabled={busy} onClick={() => saveField(null)}>Not assigned</button>}</> : <form onSubmit={(event) => { event.preventDefault(); void saveField(input.trim()); }}><label htmlFor="staff-private-reply">{FIELD_LABELS[activeField]}</label><input ref={inputRef} id="staff-private-reply" type={activeField === "email" ? "email" : "text"} required maxLength={activeField === "email" ? 254 : 120} autoComplete="off" value={input} onChange={(event) => setInput(event.target.value)} disabled={busy} /><button disabled={busy || !input.trim()}>Continue</button></form>}
        </div>}
        {!activeField && action.state !== "review" && <p>Choose a field to change, or review the proposed account.</p>}
        <details ref={editFieldsRef} className="staff-edit-details"><summary>Edit details</summary><div aria-label="Correct staff details">{Object.entries(FIELD_LABELS).filter(([key]) => action.kind === "register" || key !== "email").map(([key, label]) => <button key={key} type="button" disabled={busy} onClick={() => { setField(key); setInput(""); setPassword(""); setConfirmation(""); setShowPasswords(false); }}>{`Change ${label.toLowerCase()}`}</button>)}</div></details>
        {!activeField && action.state !== "review" && <button ref={reviewRef} type="button" disabled={busy || stale} onClick={() => run(async () => remember((await request(`/chat-actions/${action.id}/review`, "POST")).action))}>Review change</button>}
        {action.state === "review" && !field && <div aria-label="Confirm staff change"><Snapshot title={action.kind === "register" ? "Account details" : "Before"} value={action.kind === "register" ? action.after : action.before} />{action.kind === "edit" && <Snapshot title="After" value={action.after} />}<p>{action.kind === "register" ? "Check the details, then set a password to create this account." : "Check the before and after details, then save your changes."}</p>
          {action.kind === "register" && <div className="staff-passwords">
            <p id="staff-password-rule">Use 12–128 characters. A password cannot contain only whitespace.</p>
            <label htmlFor="staff-secure-password">Password</label><input ref={passwordRef} id="staff-secure-password" type={showPasswords ? "text" : "password"} minLength={12} maxLength={128} autoComplete="new-password" aria-describedby="staff-password-rule staff-password-feedback" aria-invalid={Boolean(passwordError)} value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
            <p id="staff-password-feedback" className="staff-field-feedback" aria-live="polite">{passwordError || "Password meets the requirements."}</p>
            <label htmlFor="staff-secure-confirmation">Confirm password</label><input id="staff-secure-confirmation" type={showPasswords ? "text" : "password"} autoComplete="new-password" aria-describedby="staff-confirmation-feedback" aria-invalid={Boolean(confirmationError)} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} />
            <p id="staff-confirmation-feedback" className="staff-field-feedback" aria-live="polite">{confirmationError || "Passwords match."}</p>
            <label className="staff-show-passwords"><input type="checkbox" checked={showPasswords} onChange={(event) => setShowPasswords(event.target.checked)} disabled={busy} />Show passwords</label>
          </div>}
          <button ref={confirmRef} className="staff-primary-action" type="button" disabled={busy || stale || (action.kind === "register" && Boolean(passwordError || confirmationError))} onClick={confirm}>{busy ? "Saving…" : finalLabel}</button>
        </div>}
      </>}
      <button type="button" disabled={busy} onClick={() => run(async () => { await cancel(); onExit(); })}>Cancel staff change</button>
    </>}
    {(!action || result) && <button type="button" disabled={busy} onClick={onOtherControls}>Other staff controls</button>}
  </section>;
});
export default StaffConversation;
