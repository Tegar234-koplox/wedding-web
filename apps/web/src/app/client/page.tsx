import type { Metadata } from "next";
import type { Route } from "next";

import {
  DashboardShell,
  OperationsGrid,
  WorkflowList,
} from "@/components/operations/dashboard-shell";

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
      <OperationsGrid
        items={[
          {
            title: "Draft",
            metric: "Edit",
            body: "Client dapat memperbarui data undangan terstruktur sebelum publish.",
          },
          {
            title: "Approval",
            metric: "OK",
            body: "Approval publish dikirim client, publish final tetap dilakukan staff.",
          },
          {
            title: "RSVP",
            metric: "CSV",
            body: "Daftar tamu, RSVP, ucapan, dan export data tersedia per invitation.",
          },
          {
            title: "Music",
            metric: "MP3",
            body: "Backsound memakai media invitation dan mengikuti batasan paket.",
          },
        ]}
      />

      <div className="mt-16 grid gap-12 lg:grid-cols-[0.7fr_1fr]" id="draft">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.22em] text-[var(--color-gold)]">
            Client flow
          </p>
          <h2 className="mt-5 font-serif text-5xl leading-none">
            Dari draft ke publish.
          </h2>
        </div>
        <WorkflowList
          steps={[
            {
              label: "Login",
              detail: "Order dan invitation milik client.",
            },
            {
              label: "Edit data",
              detail: "Konten undangan, detail acara, dan catatan revisi.",
            },
            {
              label: "Submit revisi",
              detail: "Draft kembali ke staff review.",
            },
            {
              label: "Approve",
              detail: "Persetujuan client sebelum publish final.",
            },
            {
              label: "Export",
              detail: "Data RSVP aktif untuk arsip acara.",
            },
          ]}
        />
      </div>

      <div className="mt-16 grid gap-px bg-white/12 md:grid-cols-2" id="rsvp">
        {["Personal RSVP link", "Privacy retention"].map((item) => (
          <article className="bg-[#181815] p-7" key={item}>
            <h2 className="font-serif text-3xl">{item}</h2>
            <p className="mt-6 text-sm leading-6 text-white/58">
              Status hadir, jumlah tamu, ucapan, export, dan retensi 12 bulan.
            </p>
          </article>
        ))}
      </div>
    </DashboardShell>
  );
}
