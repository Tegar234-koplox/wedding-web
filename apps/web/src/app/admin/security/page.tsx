import type { Metadata } from "next";

import { AdminDashboardGate } from "@/components/operations/admin-dashboard-gate";
import { AdminSecurity } from "@/components/operations/admin-security";

export const metadata: Metadata = {
  title: "Staff Security",
  robots: { index: false, follow: false },
};

export default function AdminSecurityPage() {
  return (
    <AdminDashboardGate
      description="Kelola autentikasi berlapis dan verifikasi ulang untuk aksi operasional sensitif."
      title="Staff security."
    >
      <AdminSecurity />
    </AdminDashboardGate>
  );
}
