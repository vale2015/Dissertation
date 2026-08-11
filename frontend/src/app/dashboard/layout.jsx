import DashboardAccessGuard from"@/components/auth/DashboardAccessGuard";export default function DashboardLayout({children}){return <DashboardAccessGuard>{children}</DashboardAccessGuard>}
