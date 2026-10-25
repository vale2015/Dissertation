export default function StaffStatusDialog({ member, status, onConfirm, onClose, busy }) {
  return <div className="staff-modal-backdrop"><section className="staff-modal" role="alertdialog" aria-modal="true" aria-labelledby="staff-status-title">
    <h2 id="staff-status-title">Confirm account change</h2>
    <p>Change {member.full_name} from {member.status} to {status}? Suspension blocks access immediately. Deactivation is retained for audit purposes.</p>
    <div className="staff-modal-actions"><button type="button" onClick={onClose} disabled={busy}>Cancel</button><button type="button" onClick={onConfirm} disabled={busy}>{busy ? "Updating…" : `Confirm ${status}`}</button></div>
  </section></div>;
}
