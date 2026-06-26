import type { Metadata } from "next";
import type { Route } from "next";

import { AdminLogin } from "@/components/operations/admin-login";
import { DashboardShell } from "@/components/operations/dashboard-shell";

export const metadata: Metadata = {
  title: "Staff Login",
  description: "Staff login for Niskala wedding operations.",
  robots: { index: false, follow: false },
};

const nav: Array<{ href: Route; label: string }> = [
  { href: "/admin/login" as Route, label: "Login" },
  { href: "/admin", label: "Dashboard" },
];

export default function AdminLoginPage() {
  return (
    <DashboardShell
      description="Gunakan akun staff untuk mengakses order, lead, workflow, dan audit operasional."
      eyebrow="Admin Access"
      nav={nav}
      title="Staff login."
    >
      <AdminLogin />
    </DashboardShell>
  );
}
