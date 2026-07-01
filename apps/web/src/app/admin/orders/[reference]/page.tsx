import type { Metadata } from "next";

import { AdminDashboardGate } from "@/components/operations/admin-dashboard-gate";
import { AdminOrderDetail } from "@/components/operations/admin-order-detail";

type AdminOrderPageProps = {
  params: Promise<{ reference: string }>;
};

export const metadata: Metadata = {
  title: "Update Order",
  description: "Kelola detail order manual staff Niskala.",
  robots: { index: false, follow: false },
};

export default async function AdminOrderPage({ params }: AdminOrderPageProps) {
  const { reference } = await params;

  return (
    <AdminDashboardGate
      description="Update detail customer, acara, media, pembayaran, preview, dan catatan revisi."
      title={`Update ${reference}.`}
    >
      <AdminOrderDetail reference={reference} />
    </AdminDashboardGate>
  );
}
