"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { AdminOperations } from "@/components/operations/admin-operations";
import { DashboardShell } from "@/components/operations/dashboard-shell";
import {
  clearStaffGateCookie,
  staffFetch,
  type StaffSession,
} from "@/components/operations/staff-api";

type AdminDashboardGateProps = {
  children?: ReactNode;
  description?: string;
  title?: string;
};

const nav: Array<{ href: Route; label: string }> = [
  { href: "/admin", label: "Orders" },
  { href: "/admin/security" as Route, label: "Security" },
];

async function verifyStaffSession(): Promise<StaffSession> {
  return staffFetch<StaffSession>("/auth/me");
}

export function AdminDashboardGate({
  children,
  description = "Kelola order manual, data customer, pembayaran transfer, preview undangan, dan catatan revisi dari satu area staff.",
  title = "Order management.",
}: AdminDashboardGateProps) {
  const router = useRouter();
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      try {
        await verifyStaffSession();
        if (!cancelled) {
          setVerified(true);
        }
      } catch {
        clearStaffGateCookie();
        if (!cancelled) {
          router.replace("/admin/login");
        }
      }
    }

    void verify();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!verified) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#11110f] px-6 text-[var(--color-ink)]">
        <div className="border border-white/12 bg-[#181815] p-6 text-sm text-white/60">
          Memverifikasi session staff...
        </div>
      </main>
    );
  }

  return (
    <DashboardShell
      compact
      description={description}
      eyebrow="Staff Operations"
      nav={nav}
      title={title}
    >
      {children ?? <AdminOperations />}
    </DashboardShell>
  );
}
