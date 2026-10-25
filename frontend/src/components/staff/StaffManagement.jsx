"use client";
import { useEffect, useMemo, useState } from "react";
import useStaff from "@/hooks/useStaff";
import StaffFilters from "./StaffFilters";
import StaffTable from "./StaffTable";
import InviteStaffModal from "./InviteStaffModal";
import ActivationLinkDialog from "./ActivationLinkDialog";
import EditStaffModal from "./EditStaffModal";
import StaffStatusDialog from "./StaffStatusDialog";
import StaffResetDialog from "./StaffResetDialog";

export default function StaffManagement({ initialSearch = "" }) {
  const [filters, setFilters] = useState({ search: initialSearch, status: "", role: "", staff_role_id: "" });
  useEffect(() => setFilters((current) => ({ ...current, search: initialSearch })), [initialSearch]);
  const stable = useMemo(() => filters, [filters]);
  const api = useStaff(stable);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [link, setLink] = useState(null);
  const [edit, setEdit] = useState(null);
  const [statusAction, setStatusAction] = useState(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [resetAction, setResetAction] = useState(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function perform(task, message) {
    try {
      const result = await task();
      setNotice(message);
      return result;
    } catch (error) {
      setNotice(error.message);
      throw error;
    }
  }

  async function confirmReset() {
    if (!resetAction || resetBusy) return;
    setResetBusy(true);
    try {
      const result = await perform(() => api.reset(resetAction.id), "Password-reset link generated.");
      setResetAction(null);
      setLink(result);
    } catch {
      // The notice above reports the error; a failed request is never retried automatically.
    } finally {
      setResetBusy(false);
    }
  }

  return <>
    <div className="staff-page-header"><div><h1>Staff Management</h1><p>Manage application access separately from operational restaurant roles.</p></div><button type="button" onClick={() => setRegisterOpen(true)}>Register staff member</button></div>
    <div aria-live="polite">{notice && <p className="staff-notice">{notice}</p>}</div>
    <StaffFilters value={filters} onChange={setFilters} roles={api.roles} />
    {api.loading ? <p>Loading staff accounts…</p> : api.error ? <p role="alert">{api.error}</p> : <StaffTable staff={api.staff} onEdit={setEdit} onStatus={(member, status) => setStatusAction({ member, status })} onReset={setResetAction} />}
    {registerOpen && <InviteStaffModal roles={api.roles} onClose={() => setRegisterOpen(false)} onSubmit={async (values) => { await perform(() => api.register(values), "Staff member registered and ready to sign in."); setRegisterOpen(false); }} />}
    {link && <ActivationLinkDialog result={link} onClose={() => setLink(null)} />}
    {edit && <EditStaffModal member={edit} roles={api.roles} onClose={() => setEdit(null)} onSubmit={async (values) => { await perform(() => api.update(edit.id, values), "Staff account updated."); setEdit(null); }} />}
    {statusAction && <StaffStatusDialog {...statusAction} busy={statusBusy} onClose={() => setStatusAction(null)} onConfirm={async () => {
      if (statusBusy) return;
      setStatusBusy(true);
      try { await perform(() => api.status(statusAction.member.id, statusAction.status), "Account status updated."); setStatusAction(null); }
      catch { /* The notice above reports the error; no automatic retry. */ }
      finally { setStatusBusy(false); }
    }} />}
    {resetAction && <StaffResetDialog member={resetAction} busy={resetBusy} onClose={() => setResetAction(null)} onConfirm={confirmReset} />}
  </>;
}
