"use client";

import { usePathname } from "next/navigation";
import useSession from "@/hooks/useSession";
import { dashboardPermission } from "@/lib/dashboard-permissions";
import { hasPermission } from "@/lib/permissions";
import AccessDenied from "./AccessDenied";

export default function DashboardAccessGuard({ children }) {
  const path = usePathname();
  const { user, loading, error } = useSession();

  if (loading) return <main className="account-page" aria-live="polite">Checking access…</main>;
  if (error) return <main className="account-page"><section role="alert"><h1>Session unavailable</h1><p>{error}</p></section></main>;

  const permission = dashboardPermission(path);
  return !permission || hasPermission(user, permission)
    ? children
    : <main className="account-page"><AccessDenied /></main>;
}
