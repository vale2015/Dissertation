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

function Snapshot({ value, title }) {
  if (!value) return null;
  return <div><h4>{title}</h4><dl>{[["Account", value.id], ["Name", value.full_name], ["Email", value.email], ["Access", value.application_role || value.role], ["Restaurant role", value.staff_role_name || (value.staff_role_id == null ? "Not assigned" : `Role #${value.staff_role_id}`)], ["Status", value.status]].filter(([, v]) => v != null).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></div>;
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
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState(null);
  const [stale, setStale] = useState(false);
  const [mode, setMode] = useState(command.kind);
  const inputRef = useRef(null);
  const passwordRef = useRef(null);
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
    setPassword(""); setConfirmation(""); setInput("");
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
  useEffect(() => {
    if (busy) return;
    if (action?.state === "review" && action.kind === "register") passwordRef.current?.focus();
    else inputRef.current?.focus();
  }, [busy, activeField, action?.state, action?.kind]);

  async function saveField(value) {
    if (!activeField || !action || busy) return;
    await run(async () => {
      const next = (await request(`/chat-actions/${action.id}`, "PATCH", { [activeField]: value })).action;
      remember(next); setStale(false); setInput(""); setField(null); setPassword(""); setConfirmation("");
    });
  }

  async function confirm() {
    const secrets = action.kind === "register" ? { password, password_confirmation: confirmation } : {};
    setPassword(""); setConfirmation("");
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

  return <section className="staff-conversation" aria-label="Private staff conversation">
    <h3>Staff conversation</h3>
    <p>Details stay in this protected workspace. They are never sent to AI or added to the general conversation. Drafts expire after 15 minutes.</p>
    {busy && <p role="status">Checking staff details…</p>}
    {notice && <p role="alert">{notice}</p>}
    {stale && <button type="button" disabled={busy} onClick={() => run(async () => { setPassword(""); setConfirmation(""); if (!await restore()) setMode("choose"); })}>Reload draft</button>}
    {result ? <><p role="status">The account change is confirmed and verified.</p><Snapshot title="Saved account" value={result} /><button type="button" onClick={() => { remember(null); onExit(); }}>Finish</button></> : <>
      {!action && mode === "choose" && <div><p>What would you like to do?</p><button type="button" disabled={busy} onClick={() => run(async () => { setMode("register"); remember((await request("/chat-actions", "POST", { kind: "register" })).action); })}>Register a staff member</button><button type="button" disabled={busy} onClick={() => setMode("edit")}>Edit a staff member</button></div>}
      {!action && mode === "edit" && <form onSubmit={(event) => { event.preventDefault(); void run(() => lookup(input.trim())); }}><label htmlFor="staff-private-reply">Whose account should I edit? Enter a name or email.</label><input ref={inputRef} id="staff-private-reply" autoComplete="off" maxLength={80} value={input} onChange={(event) => setInput(event.target.value)} disabled={busy} /><button disabled={busy || input.trim().length < 2}>Find account</button></form>}
      {matches && <div aria-label="Matching staff accounts">{matches.length === 0 && <p>No matching accounts. Try the full name or email.</p>}{matches.map((member) => <button key={member.id} type="button" disabled={busy} onClick={() => run(async () => { remember((await request("/chat-actions", "POST", { kind: "edit", target_user_id: member.id })).action); setTarget(member); setMatches(null); })}>{member.full_name} · {member.email} · #{member.id} · {member.status}</button>)}</div>}
      {action && <>
        <Snapshot title={action.kind === "edit" ? "Selected account" : "Registration draft"} value={action.before || target || { ...action.draft, staff_role_name: roles.find((role) => role.id === action.draft?.staff_role_id)?.role_name }} />
        {activeField && <div><p>{STAFF_FIELDS[activeField]}: {activeField === "application_role" ? "Choose application access." : activeField === "staff_role_id" ? "Choose the restaurant role." : "Enter the value below. Do not enter a password here."}</p>
          {activeField === "application_role" ? ["staff", "supervisor", "manager"].map((role) => <button key={role} type="button" disabled={busy} onClick={() => saveField(role)}>{role}</button>) : activeField === "staff_role_id" ? <>{roles.map((role) => <button key={role.id} type="button" disabled={busy} onClick={() => saveField(role.id)}>{role.role_name}</button>)}{(action.draft?.application_role || target?.application_role || action.before?.application_role) !== "staff" && <button type="button" disabled={busy} onClick={() => saveField(null)}>Not assigned</button>}</> : <form onSubmit={(event) => { event.preventDefault(); void saveField(input.trim()); }}><label htmlFor="staff-private-reply">{STAFF_FIELDS[activeField]}</label><input ref={inputRef} id="staff-private-reply" type={activeField === "email" ? "email" : "text"} required maxLength={activeField === "email" ? 254 : 120} autoComplete="off" value={input} onChange={(event) => setInput(event.target.value)} disabled={busy} /><button disabled={busy || !input.trim()}>Continue</button></form>}
        </div>}
        {!activeField && action.state !== "review" && <p>Choose a field to change, or review the proposed account.</p>}
        <div aria-label="Correct staff details">{Object.entries(STAFF_FIELDS).filter(([key]) => action.kind === "register" || key !== "email").map(([key, label]) => <button key={key} type="button" disabled={busy} onClick={() => { setField(key); setInput(""); setPassword(""); setConfirmation(""); }}>{`Change ${label.toLowerCase()}`}</button>)}</div>
        {!activeField && action.state !== "review" && <button type="button" disabled={busy || stale} onClick={() => run(async () => remember((await request(`/chat-actions/${action.id}/review`, "POST")).action))}>Review change</button>}
        {action.state === "review" && !field && <div aria-label="Confirm staff change"><Snapshot title="Before" value={action.before} /><Snapshot title="After" value={action.after} /><p>Review the exact account and values above. Only the Confirm change button saves this change.</p>
          {action.kind === "register" && <><label htmlFor="staff-secure-password">Password</label><input ref={passwordRef} id="staff-secure-password" type="password" minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} /><label htmlFor="staff-secure-confirmation">Confirm password</label><input id="staff-secure-confirmation" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={busy} /><p>Use 12 to 128 non-blank characters.</p></>}
          <button type="button" disabled={busy || stale || (action.kind === "register" && (password.length < 12 || password.length > 128 || !password.trim() || password !== confirmation))} onClick={confirm}>Confirm change</button>
        </div>}
      </>}
      <button type="button" disabled={busy} onClick={() => run(async () => { await cancel(); onExit(); })}>Cancel staff change</button>
    </>}
    <button type="button" disabled={busy || Boolean(action && !result)} onClick={onOtherControls}>Other staff controls</button>
  </section>;
});
export default StaffConversation;
