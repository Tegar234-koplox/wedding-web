import type { Metadata } from "next";

import { GuestDeliveryWorkspace } from "@/components/guest-delivery/guest-delivery-workspace";

export const metadata: Metadata = {
  title: "Ucapan Tamu",
  robots: { index: false, follow: false, nocache: true },
};

export default function ClientPortalWishesPage() {
  return <GuestDeliveryWorkspace mode="wishes" />;
}
