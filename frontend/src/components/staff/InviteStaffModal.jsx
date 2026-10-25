"use client";
import { useState } from "react";

export default function RegisterStaffModal({ roles, onSubmit, onClose }) {
  const [form, setForm] = useState({ full_name: "", email: "", password: "", password_confirmation: "", application_role: "staff", staff_role_id: "" });
  const [review, setReview] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!review) {
      if (form.password !== form.password_confirmation) { setError("Passwords do not match."); return; }
      setReview(true);
      return;
    }
    if (busy) return;
    setBusy(true);
    try { await onSubmit(form); } catch (caught) { setError(caught.message); } finally { setBusy(false); }
  }

  const operationalRole = roles.find((role) => String(role.id) === String(form.staff_role_id));
  return <div className="staff-modal-backdrop"><section className="staff-modal" role="dialog" aria-modal="true" aria-labelledby="register-title">
    <h2 id="register-title">{review ? "Review staff registration" : "Register staff member"}</h2>
    <p>Create an active account. Give the initial password to the staff member securely.</p>
    <form onSubmit={submit}>
      {review ? <div className="staff-review"><p><strong>Name:</strong> {form.full_name}</p><p><strong>Email:</strong> {form.email}</p><p><strong>Application role:</strong> {form.application_role}</p><p><strong>Operational role:</strong> {operationalRole ? `${operationalRole.department} · ${operationalRole.role_name}` : "Not assigned"}</p><p>The initial password is hidden. Confirm only if these details are correct.</p></div> : <>
        <label>Full name<input required value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /></label>
        <label>Email<input type="email" autoComplete="off" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label>Initial password<div className="login-password-wrap"><input className="login-input" type={showPasswords ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={128} required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /><button type="button" onClick={() => setShowPasswords((value) => !value)} aria-label={showPasswords ? "Hide passwords" : "Show passwords"}>{showPasswords ? "Hide" : "Show"}</button></div></label>
        <label>Confirm password<input type={showPasswords ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={128} required value={form.password_confirmation} onChange={(event) => setForm({ ...form, password_confirmation: event.target.value })} /></label>
        <p>Use 12 to 128 characters.</p>
        <label>Application role<select value={form.application_role} onChange={(event) => setForm({ ...form, application_role: event.target.value })}>{["staff", "supervisor", "manager"].map((role) => <option key={role}>{role}</option>)}</select></label>
        <label>Operational role<select value={form.staff_role_id} onChange={(event) => setForm({ ...form, staff_role_id: event.target.value })}><option value="">Not assigned</option>{roles.map((role) => <option value={role.id} key={role.id}>{role.department} · {role.role_name}</option>)}</select></label>
      </>}
      {error && <p role="alert">{error}</p>}
      <div className="staff-modal-actions"><button type="button" onClick={review ? () => setReview(false) : onClose} disabled={busy}>{review ? "Back" : "Cancel"}</button><button disabled={busy}>{busy ? "Registering…" : review ? "Confirm registration" : "Review registration"}</button></div>
    </form>
  </section></div>;
}
