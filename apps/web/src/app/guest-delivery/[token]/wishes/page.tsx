import type { Metadata } from "next";

import { GuestDeliveryWorkspace } from "@/components/guest-delivery/guest-delivery-workspace";

type GuestDeliveryWishesPageProps = {
  params: Promise<{ token: string }>;
};

export const metadata: Metadata = {
  title: "Ucapan Tamu",
  description: "Rekap RSVP dan ucapan tamu untuk client Niskala.",
  robots: { index: false, follow: false },
};

export default async function GuestDeliveryWishesPage({
  params,
}: GuestDeliveryWishesPageProps) {
  const { token } = await params;

  return <GuestDeliveryWorkspace mode="wishes" token={token} />;
}
