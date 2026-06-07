"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import DashboardContent from "@/components/dashboard/dashboardContent";

// Protected dashboard page shown after the user logs in.
export default function DashboardPage() {
  const router = useRouter();
  // Store the logged-in user details from local storage.
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check if the user has a valid token before showing the dashboard.
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (!storedToken || !storedUser) {
      
      router.push("/login");
      return;
    }

    setUser(JSON.parse(storedUser));
  }, [router]);

  if (!user) return null;

  return (
    <div className="dashboard-app">
      <Topbar user={user} />

      <div className="dashboard-shell">
        <Sidebar />

        <div className="dashboard-main-area">
          <main className="dashboard-page">
            <div className="dashboard-container">
              <DashboardContent user={user} />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}