import DashboardAccessGuard from "@/components/auth/DashboardAccessGuard";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";

export default function DashboardLayout({ children }) {
  return (
    <DashboardAccessGuard>
      <div className="dashboard-app">
        <div className="dashboard-shell">
          <Sidebar />
          <div className="dashboard-main-area">
            <Topbar />
            <main className="dashboard-page">
              <div className="dashboard-container">{children}</div>
            </main>
          </div>
        </div>
      </div>
    </DashboardAccessGuard>
  );
}
