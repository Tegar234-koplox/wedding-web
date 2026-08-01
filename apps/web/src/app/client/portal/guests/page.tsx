import type { Metadata } from "next";

import { GuestDeliveryWorkspace } from "@/components/guest-delivery/guest-delivery-workspace";

export const metadata: Metadata = {
  title: "Daftar Link Personal",
  robots: { index: false, follow: false, nocache: true },
};

export default function ClientPortalGuestsPage() {
  return <GuestDeliveryWorkspace mode="list" />;
}
