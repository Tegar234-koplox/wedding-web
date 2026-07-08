import type { Metadata } from "next";

import { GuestDeliveryWorkspace } from "@/components/guest-delivery/guest-delivery-workspace";

type GuestDeliveryGuestListPageProps = {
  params: Promise<{ token: string }>;
};

export const metadata: Metadata = {
  title: "Daftar Tamu",
  description: "Tracking pengiriman link personal tamu undangan Niskala.",
  robots: { index: false, follow: false },
};

export default async function GuestDeliveryGuestListPage({
  params,
}: GuestDeliveryGuestListPageProps) {
  const { token } = await params;

  return <GuestDeliveryWorkspace mode="list" token={token} />;
}
