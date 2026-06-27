import type { Metadata } from "next";

import { ClientLogin } from "@/components/operations/client-login";
import { DashboardShell } from "@/components/operations/dashboard-shell";

export const metadata: Metadata = {
  title: "Client Login",
  description: "Client login for Niskala invitation draft review.",
  robots: { index: false, follow: false },
};

export default function ClientLoginPage() {
  return (
    <DashboardShell
      description="Gunakan akun client untuk meninjau undangan, mengirim revisi, dan memberi approval publish."
      eyebrow="Client Access"
      nav={[]}
      title="Client login."
    >
      <ClientLogin />
    </DashboardShell>
  );
}
