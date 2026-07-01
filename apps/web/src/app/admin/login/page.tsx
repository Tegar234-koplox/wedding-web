import type { Metadata } from "next";

import { AdminLogin } from "@/components/operations/admin-login";
import { DashboardShell } from "@/components/operations/dashboard-shell";

export const metadata: Metadata = {
  title: "Staff Login",
  description: "Staff login for Niskala wedding operations.",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <DashboardShell
      description="Gunakan akun staff untuk mengakses order, lead, workflow, dan audit operasional."
      eyebrow="Admin Access"
      nav={[]}
      title="Staff login."
    >
      <AdminLogin />
    </DashboardShell>
  );
}
