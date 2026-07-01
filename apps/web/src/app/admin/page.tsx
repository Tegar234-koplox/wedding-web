import type { Metadata } from "next";

import { AdminDashboardGate } from "@/components/operations/admin-dashboard-gate";

export const metadata: Metadata = {
  title: "Admin Operations",
  description: "Staff operations dashboard for Niskala wedding invitation orders.",
  robots: { index: false, follow: false },
};

export default function AdminDashboardPage() {
  return <AdminDashboardGate />;
}
