"use client";

import { Eye, Loader2 } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";

import {
  consumeGrantFragment,
  useGrantFragment,
} from "@/lib/use-grant-fragment";

type RedeemResponse = {
  csrf_token?: string;
  redirect_to: string;
};

function invitationRedirectPath(value: string): Route {
  const url = new URL(value, window.location.origin);
  if (!/^\/(?:id|en)\/i\/[^/]+\/?$/.test(url.pathname)) {
    throw new Error("Tujuan preview dari server tidak valid.");
  }
  return `${url.pathname}${url.search}` as Route;
}

async function responseMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      detail?: string;
      error?: { message?: string };
    };
    return (
      payload.detail ??
      payload.error?.message ??
      "Link preview tidak valid atau sudah kedaluwarsa."
    );
  } catch {
    return "Link preview tidak valid atau sudah kedaluwarsa.";
  }
}

export function PreviewGrantRedeemer() {
  const router = useRouter();
  const token = useGrantFragment();
  const attemptedToken = useRef("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || attemptedToken.current === token) {
      return;
    }
    attemptedToken.current = token;

    async function redeem() {
      try {
        const response = await fetch("/api/preview/redeem", {
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
          throw new Error(await responseMessage(response));
        }
        const payload = (await response.json()) as RedeemResponse;
        if (payload.csrf_token) {
          window.sessionStorage.setItem(
            "niskala-preview-csrf",
            payload.csrf_token,
          );
        }
        consumeGrantFragment();
        router.replace(invitationRedirectPath(payload.redirect_to));
        router.refresh();
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Preview tidak dapat dibuka.",
        );
      }
    }

    void redeem();
  }, [router, token]);

  const missingToken = !token;
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 py-14 text-white">
      <section className="w-full max-w-md border border-white/12 bg-white/[0.025] p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[var(--color-gold)]/60 text-[var(--color-gold)]">
          {error || missingToken ? <Eye size={22} /> : <Loader2 className="animate-spin" size={22} />}
        </div>
        <p className="mt-7 text-[0.65rem] uppercase tracking-[0.3em] text-[var(--color-gold)]">
          Preview Aman
        </p>
        <h1 className="mt-3 font-serif text-4xl">
          {error || missingToken ? "Preview tidak tersedia." : "Membuka preview."}
        </h1>
        <p className="mt-4 text-sm leading-7 text-white/60">
          {missingToken
            ? "Link preview tidak lengkap atau token sudah dibersihkan dari alamat browser."
            : error || "Tunggu sebentar, akses preview sedang diverifikasi."}
        </p>
      </section>
    </main>
  );
}
