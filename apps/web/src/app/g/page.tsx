import type { Metadata } from "next";

import { GuestGrantRedeemer } from "@/components/guest-access/guest-grant-redeemer";

export const metadata: Metadata = {
  title: "Undangan Personal",
  robots: { index: false, follow: false, nocache: true },
};

export default function GuestAccessPage() {
  return <GuestGrantRedeemer />;
}
