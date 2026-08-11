import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import DashboardContent from "@/components/dashboard/dashboardContent";


// Ensure the authenticated dashboard is never statically cached.
export const dynamic = "force-dynamic";


// Validate the HttpOnly session with the Flask backend.
async function getAuthenticatedUser() {
  const backendApiUrl = process.env.BACKEND_API_URL?.replace(/\/$/, "");

  if (!backendApiUrl) {
    console.error("BACKEND_API_URL is not configured.");
    return null;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("rfs_session")?.value;

  if (!token) {
    return null;
  }

  try {
    const response = await fetch(
      `${backendApiUrl}/auth/me`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return data?.user || null;
  } catch (error) {
    console.error("Dashboard authentication check failed:", error);
    return null;
  }
}


// Protected dashboard page.
export default async function DashboardPage() {
  const user = await getAuthenticatedUser();

  // Your login page is "/", not "/login".
  if (!user) {
    redirect("/");
  }

  if (user.role === "staff") {
    redirect("/dashboard/profile");
  }

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
