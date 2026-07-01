"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AdminOperations } from "@/components/operations/admin-operations";
import { DashboardShell } from "@/components/operations/dashboard-shell";
import { env } from "@/lib/env";

type StaffSession = {
  user: {
    username: string;
    email: string;
    role: string;
    display_name: string;
  };
};

const staffGateCookie = "niskala_staff_gate";

const nav: Array<{ href: Route; label: string }> = [
  { href: "/admin", label: "Overview" },
  { href: "/admin#orders", label: "Orders" },
  { href: "/admin#detail", label: "Detail" },
  { href: "/admin#revisi", label: "Revisi" },
];

function staffGateCookieAttributes(maxAge: number) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  return `Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

function clearStaffGateCookie() {
  document.cookie = `${staffGateCookie}=; ${staffGateCookieAttributes(0)}`;
}

async function verifyStaffSession(): Promise<StaffSession> {
  const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/auth/me`, {
    cache: "no-store",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Staff session invalid (${response.status}).`);
  }
  return (await response.json()) as StaffSession;
}

export function AdminDashboardGate() {
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
      description="Kelola lead WhatsApp, order manual, produksi invitation, media, katalog tema/paket, approval, dan audit dari satu area staff."
      eyebrow="Staff Operations"
      nav={nav}
      title="Admin content & order operations."
    >
      <AdminOperations />
    </DashboardShell>
  );
}
