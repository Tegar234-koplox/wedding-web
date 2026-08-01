import type { Metadata } from "next";

import { ClientAccessForm } from "@/components/client-portal/client-access-form";

export const metadata: Metadata = {
  title: "Login Portal Client",
  robots: { index: false, follow: false, nocache: true },
};

export default async function ClientLoginPage({
  params,
}: {
  params: Promise<{ grantId: string }>;
}) {
  const { grantId } = await params;
  return <ClientAccessForm grantId={grantId} mode="login" />;
}
