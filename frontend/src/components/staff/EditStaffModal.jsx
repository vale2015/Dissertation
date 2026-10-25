"use client";
import { useState } from "react";

export default function EditStaffModal({ member, roles, onSubmit, onClose }) {
  const [form, setForm] = useState({ full_name: member.full_name, application_role: member.role, staff_role_id: member.staff_role_id || "" });
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const role = roles.find((item) => String(item.id) === String(form.staff_role_id));

  async function submit(event) {
    event.preventDefault();
    if (!review) { setReview(true); return; }
    if (busy) return;
    setBusy(true);
    setError("");
    try { await onSubmit(form); } catch (caught) { setError(caught.message); } finally { setBusy(false); }
  }

  return <div className="staff-modal-backdrop"><section className="staff-modal" role="dialog" aria-modal="true" aria-labelledby="staff-edit-title">
    <h2 id="staff-edit-title">{review ? `Review changes for ${member.full_name}` : `Edit ${member.full_name}`}</h2>
    <form onSubmit={submit}>
      {review ? <div className="staff-review"><p><strong>Name:</strong> {member.full_name} → {form.full_name}</p><p><strong>Application role:</strong> {member.role} → {form.application_role}</p><p><strong>Operational role:</strong> {member.staff_role_name || "Not assigned"} → {role?.role_name || "Not assigned"}</p></div> : <>
        <label>Full name<input required value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /></label>
        <label>Application role<select value={form.application_role} onChange={(event) => setForm({ ...form, application_role: event.target.value })}>{["staff", "supervisor", "manager"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Operational role<select value={form.staff_role_id} onChange={(event) => setForm({ ...form, staff_role_id: event.target.value })}><option value="">Not assigned</option>{roles.map((item) => <option value={item.id} key={item.id}>{item.department} · {item.role_name}</option>)}</select></label>
      </>}
      {error && <p role="alert">{error}</p>}
      <div className="staff-modal-actions"><button type="button" disabled={busy} onClick={review ? () => setReview(false) : onClose}>{review ? "Back" : "Cancel"}</button><button disabled={busy}>{busy ? "Saving…" : review ? "Confirm changes" : "Review changes"}</button></div>
    </form>
  </section></div>;
}
