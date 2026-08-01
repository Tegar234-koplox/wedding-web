"use client";

import { LogOut } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function clientCsrfToken(): Promise<string> {
  const stored = window.sessionStorage.getItem("niskala-client-csrf") ?? "";
  if (stored) {
    return stored;
  }
  const response = await fetch("/api/client/me", {
    cache: "no-store",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    return "";
  }
  const payload = (await response.json()) as { csrf_token?: string };
  const token = payload.csrf_token ?? "";
  if (token) {
    window.sessionStorage.setItem("niskala-client-csrf", token);
  }
  return token;
}

export function ClientPortalLogout() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    setBusy(true);
    setError("");
    try {
      const csrfToken = await clientCsrfToken();
      if (!csrfToken) {
        throw new Error("Sesi tidak dapat diverifikasi.");
      }
      const response = await fetch("/api/client/logout", {
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "X-CSRFToken": csrfToken,
        },
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Logout gagal. Muat ulang halaman lalu coba lagi.");
      }
      const accessId =
        window.localStorage.getItem("niskala-client-access-id") ?? "";
      window.sessionStorage.removeItem("niskala-client-csrf");
      window.localStorage.removeItem("niskala-client-access-id");
      const destination = UUID_PATTERN.test(accessId)
        ? (`/client/login/${accessId}` as Route)
        : ("/" as Route);
      router.replace(destination);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Logout gagal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        className="inline-flex min-h-11 items-center justify-center gap-3 border border-white/15 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] disabled:cursor-not-allowed disabled:opacity-45"
        disabled={busy}
        onClick={() => void logout()}
        type="button"
      >
        <LogOut size={15} />
        {busy ? "Keluar..." : "Logout"}
      </button>
      {error ? <p className="max-w-48 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
