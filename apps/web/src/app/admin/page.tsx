import type { Metadata } from "next";
import type { Route } from "next";

import {
  DashboardShell,
} from "@/components/operations/dashboard-shell";
import { AdminOperations } from "@/components/operations/admin-operations";

export const metadata: Metadata = {
  title: "Admin Operations",
  description: "Staff operations dashboard for Niskala wedding invitation orders.",
  robots: { index: false, follow: false },
};

const nav: Array<{ href: Route; label: string }> = [
  { href: "/admin", label: "Overview" },
  { href: "/admin#orders", label: "Orders" },
  { href: "/admin#content", label: "Content" },
  { href: "/admin#audit", label: "Audit" },
];

export default function AdminDashboardPage() {
  return (
    <DashboardShell
      description="Kelola lead WhatsApp, order manual, produksi invitation, media, katalog tema/paket, approval, dan audit dari satu area staff."
      eyebrow="Staff Operations"
      nav={nav}
      title="Admin content & order operations."
    >
      <AdminOperations />
    </DashboardShell>
  );
}
