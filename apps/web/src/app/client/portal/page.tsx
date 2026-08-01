import type { Metadata } from "next";

import { GuestDeliveryWorkspace } from "@/components/guest-delivery/guest-delivery-workspace";

export const metadata: Metadata = {
  title: "Portal Tamu Client",
  robots: { index: false, follow: false, nocache: true },
};

export default function ClientPortalPage() {
  return <GuestDeliveryWorkspace mode="import" />;
}
