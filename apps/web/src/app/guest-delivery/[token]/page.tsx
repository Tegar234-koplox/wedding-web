import type { Metadata } from "next";

import { GuestDeliveryWorkspace } from "@/components/guest-delivery/guest-delivery-workspace";

type GuestDeliveryPageProps = {
  params: Promise<{ token: string }>;
};

export const metadata: Metadata = {
  title: "Daftar Link Tamu",
  description: "Kelola link personal tamu undangan Niskala.",
  robots: { index: false, follow: false },
};

export default async function GuestDeliveryPage({ params }: GuestDeliveryPageProps) {
  const { token } = await params;

  return <GuestDeliveryWorkspace mode="import" token={token} />;
}
