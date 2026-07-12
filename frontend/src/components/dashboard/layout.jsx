import { cookies } from "next/headers";
import { redirect } from "next/navigation";


export const dynamic = "force-dynamic";


// Verify the session before rendering any dashboard route.
async function verifyDashboardSession() {
  const backendApiUrl = process.env.BACKEND_API_URL?.replace(/\/$/, "");

  if (!backendApiUrl) {
    console.error("BACKEND_API_URL is not configured.");
    return false;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("rfs_session")?.value;

  if (!token) {
    return false;
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

    return response.ok;
  } catch (error) {
    console.error("Dashboard layout authentication failed:", error);
    return false;
  }
}


// Protect /dashboard and every nested dashboard page.
export default async function ProtectedDashboardLayout({ children }) {
  const authenticated = await verifyDashboardSession();

  if (!authenticated) {
    redirect("/");
  }

  return children;
}