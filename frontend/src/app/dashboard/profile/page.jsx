"use client";

import RoleGate from "@/components/auth/RoleGate";
import UserProfile from "@/components/staff/UserProfile";
import { PERMISSIONS } from "@/lib/permissions";

export default function Page() {
  return <RoleGate permission={PERMISSIONS.VIEW_OWN_PROFILE}><UserProfile /></RoleGate>;
}
