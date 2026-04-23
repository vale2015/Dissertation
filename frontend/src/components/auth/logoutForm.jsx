"use client";

export default function LogoutForm({
  isOpen = false,
  onConfirm = () => {},
  onCancel = () => {},
}) {
  if (!isOpen) return null;

  return (
    <div className="logout-modal-overlay" onClick={onCancel}>
      <div
        className="logout-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="logout-modal-title">Confirm Logout</h2>
        <p className="logout-modal-text">
          Are you sure you want to logout?
        </p>

        <div className="logout-modal-actions">
          <button
            type="button"
            className="logout-modal-cancel"
            onClick={onCancel}
          >
            Cancel
          </button>

          <button
            type="button"
            className="logout-modal-confirm"
            onClick={onConfirm}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}