"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import LogoutForm from "@/components/auth/logoutForm";
import ManagerChat from "@/components/chatbot/ManagerChat";
import NotificationBell from "@/components/layout/NotificationBell";
import useSession from "@/hooks/useSession";

export default function Topbar({ user }) {
  const session = useSession();
  const router = useRouter();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const currentUser = user || session.user;
  const initials = (currentUser?.full_name || "RFS").trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();

  async function confirmLogout() {
    setLogoutError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", headers: { Accept: "application/json" } });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Unable to complete logout.");
      }
      setShowLogoutModal(false);
      router.replace("/");
      router.refresh();
    } catch (error) {
      setLogoutError(error.message || "Unable to complete logout.");
    }
  }

  return <>
    <header className="topbar" aria-label="Notifications and account">
      <div className="topbar-right">
        <ManagerChat />
        <NotificationBell key={currentUser?.id || "signed-out"} userId={currentUser?.id} />
        <details className="topbar-account">
          <summary aria-label="Account menu">
            <span className="topbar-avatar" aria-hidden="true">{initials}</span>
            <span className="topbar-user-name">{currentUser?.full_name || "Loading user…"}</span>
            <span className="topbar-chevron" aria-hidden="true">⌄</span>
          </summary>
          <div className="topbar-account-menu">
            <p>{currentUser?.role || "Account"}</p>
            <Link href="/dashboard/settings">Settings</Link>
            <button type="button" onClick={() => setShowLogoutModal(true)}>Logout</button>
          </div>
        </details>
      </div>
    </header>
    {logoutError && <p className="topbar-logout-error" role="alert">{logoutError}</p>}
    <LogoutForm isOpen={showLogoutModal} onConfirm={confirmLogout} onCancel={() => setShowLogoutModal(false)} />
  </>;
}
