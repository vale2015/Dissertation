"use client";

import { useState } from "react";
import StaffingRulesPage from "@/app/dashboard/staffing-rules/page";
import UserProfile from "@/components/staff/UserProfile";
import useSession from "@/hooks/useSession";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

export default function SettingsPage() {
  const { user } = useSession();
  const canManageRules = hasPermission(user, PERMISSIONS.MANAGE_STAFFING_RULES);
  const [section, setSection] = useState("account");
  const activeSection = section === "rules" && canManageRules ? "rules" : "account";

  return <div className="settings-page">
    <header className="dashboard-hero">
      <h1 className="dashboard-title">Settings</h1>
      <p className="dashboard-text">Manage your personal account and, when permitted, the restaurant&apos;s staffing rules.</p>
    </header>
    <div className="settings-tabs" aria-label="Settings sections">
      <button type="button" aria-pressed={activeSection === "account"} onClick={() => setSection("account")}>Personal account</button>
      {canManageRules && <button type="button" aria-pressed={activeSection === "rules"} onClick={() => setSection("rules")}>Staffing rules</button>}
    </div>
    {activeSection === "account" ? <section><UserProfile /></section> : <section><StaffingRulesPage /></section>}
  </div>;
}
