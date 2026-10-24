"use client";

import RoleGate from "@/components/auth/RoleGate";
import StaffManagement from "@/components/staff/StaffManagement";
import { PERMISSIONS } from "@/lib/permissions";

export default function Page() {
  return <RoleGate permission={PERMISSIONS.MANAGE_STAFF_ACCOUNTS}><StaffManagement /></RoleGate>;
}
