import type { Metadata } from "next";
import type { Route } from "next";

import {
  DashboardShell,
} from "@/components/operations/dashboard-shell";
import { ClientOperations } from "@/components/operations/client-operations";

export const metadata: Metadata = {
  title: "Client Dashboard",
  description: "Client invitation dashboard for draft review, revisions, RSVP, and music.",
  robots: { index: false, follow: false },
};

const nav: Array<{ href: Route; label: string }> = [
  { href: "/client", label: "Overview" },
  { href: "/client#draft", label: "Draft" },
  { href: "/client#rsvp", label: "RSVP" },
  { href: "/client#music", label: "Music" },
];

export default function ClientDashboardPage() {
  return (
    <DashboardShell
      description="Area client untuk meninjau undangan, memperbarui data, mengirim revisi, approval publish, mengelola tamu, dan memilih backsound."
      eyebrow="Client Workspace"
      nav={nav}
      title="Review, revise, approve."
    >
      <ClientOperations />
    </DashboardShell>
  );
}
