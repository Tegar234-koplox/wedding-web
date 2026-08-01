"use client";

import { Loader2, MailOpen } from "lucide-react";
import { useState } from "react";

import {
  consumeGrantFragment,
  useGrantFragment,
} from "@/lib/use-grant-fragment";

type RedeemResponse = {
  csrf_token: string;
  redirect_to: string;
};

export function GuestGrantRedeemer() {
  const token = useGrantFragment();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function openInvitation() {
    if (!token) {
      setError("Link undangan tidak lengkap atau sudah digunakan.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/guest/redeem", {
        body: JSON.stringify({ token }),
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Link undangan tidak valid, telah digunakan, atau kedaluwarsa.");
      }
      const payload = (await response.json()) as RedeemResponse;
      window.sessionStorage.setItem(
        "niskala-guest-csrf",
        payload.csrf_token,
      );
      consumeGrantFragment();
      window.location.replace(payload.redirect_to);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Undangan tidak dapat dibuka.",
      );
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 py-14 text-white">
      <section className="w-full max-w-md border border-white/12 bg-white/[0.025] p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[var(--color-gold)]/60 text-[var(--color-gold)]">
          <MailOpen size={22} />
        </div>
        <p className="mt-7 text-[0.65rem] uppercase tracking-[0.3em] text-[var(--color-gold)]">
          Undangan Personal
        </p>
        <h1 className="mt-3 font-serif text-4xl">Buka undangan.</h1>
        <p className="mt-4 text-sm leading-7 text-white/60">
          Klik tombol berikut untuk membuka undangan personal dan mengaktifkan
          akses RSVP pada perangkat ini.
        </p>
        {error ? (
          <p className="mt-5 border border-red-300/30 bg-red-300/10 p-3 text-sm text-red-100">
            {error}
          </p>
        ) : null}
        <button
          className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-3 bg-[var(--color-gold)] px-5 text-xs font-semibold uppercase tracking-[0.16em] text-black disabled:opacity-50"
          disabled={busy || !token}
          onClick={() => void openInvitation()}
          type="button"
        >
          {busy ? <Loader2 className="animate-spin" size={16} /> : null}
          Buka Undangan
        </button>
      </section>
    </main>
  );
}
