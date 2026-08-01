"use client";

import { ClientAccessForm } from "@/components/client-portal/client-access-form";
import { useGrantFragment } from "@/lib/use-grant-fragment";

export function ClientAccessFragment() {
  const token = useGrantFragment();

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
        <p className="text-sm text-white/60">
          Link akses tidak lengkap atau sudah dibersihkan.
        </p>
      </main>
    );
  }
  return <ClientAccessForm mode="bootstrap" token={token} />;
}
