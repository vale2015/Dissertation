"use client";

import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";

export default function DashboardLayout({ user, children }) {
  return (
    <div className="dashboard-app">
      <Topbar user={user} />

      <div className="dashboard-shell">
        <Sidebar />

        <div className="dashboard-main-area">
          <main className="dashboard-page">
            <div className="dashboard-container">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}