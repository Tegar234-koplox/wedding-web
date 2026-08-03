import type { Metadata } from "next";

import { PreviewGrantRedeemer } from "@/components/preview-access/preview-grant-redeemer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Akses Preview",
  robots: { index: false, follow: false, nocache: true },
};

export default function PreviewAccessPage() {
  return <PreviewGrantRedeemer />;
}
