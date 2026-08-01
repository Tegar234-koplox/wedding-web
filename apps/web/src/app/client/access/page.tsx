import type { Metadata } from "next";

import { ClientAccessFragment } from "@/components/client-portal/client-access-fragment";

export const metadata: Metadata = {
  title: "Akses Portal Client",
  robots: { index: false, follow: false, nocache: true },
};

export default function ClientAccessPage() {
  return <ClientAccessFragment />;
}
