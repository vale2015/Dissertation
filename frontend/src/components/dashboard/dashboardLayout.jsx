"use client";

import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
// Reusable dashboard layout used to wrap protected dashboard pages.
export default function DashboardLayout({ user, children }) {
  return (
    <div className="dashboard-app">
      <Topbar user={user} />

      <div className="dashboard-shell">
        <Sidebar />

        <div className="dashboard-main-area">
          <main className="dashboard-page">
             {/* Render the page content passed into the layout. */}
            <div className="dashboard-container">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}