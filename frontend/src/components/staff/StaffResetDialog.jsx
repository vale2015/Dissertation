export default function StaffResetDialog({ member, onConfirm, onClose, busy }) {
  return (
    <div className="staff-modal-backdrop">
      <section className="staff-modal" role="alertdialog" aria-modal="true" aria-labelledby="staff-reset-title">
        <h2 id="staff-reset-title">Confirm password reset</h2>
        <p>Generate a one-time password-reset link for {member.full_name} ({member.email})?</p>
        <p>The link will be shown once. Share it privately with this staff member.</p>
        <div className="staff-modal-actions">
          <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" onClick={onConfirm} disabled={busy}>{busy ? "Generating…" : "Generate reset link"}</button>
        </div>
      </section>
    </div>
  );
}
