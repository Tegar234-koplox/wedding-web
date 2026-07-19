"use client";

import Image from "next/image";
import { Check, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import type { Locale } from "@/lib/locales";

import styles from "./niskala-preloader.module.css";

export type PreloaderState = "loading" | "slow" | "offline" | "success" | "error";
export type PreloaderContext =
  | "site"
  | "login"
  | "refresh"
  | "logout"
  | "guest"
  | "save"
  | "submit"
  | "action";

type Copy = { description: string; title: string };

const contextCopy: Record<Locale, Record<PreloaderContext, Copy>> = {
  id: {
    action: { title: "Sedang memproses...", description: "Mohon tunggu hingga proses selesai." },
    guest: { title: "Memuat daftar tamu...", description: "Menyiapkan link personal dan data RSVP." },
    login: { title: "Memproses login staff...", description: "Memverifikasi akun dan menyiapkan sesi aman." },
    logout: { title: "Mengakhiri sesi...", description: "Menutup sesi staff dengan aman." },
    refresh: { title: "Memperbarui data...", description: "Mengambil informasi terbaru dari Niskala." },
    save: { title: "Menyimpan perubahan...", description: "Jangan tutup halaman sampai proses selesai." },
    site: { title: "Menyiapkan Niskala...", description: "Merangkai pengalaman undangan untuk Anda." },
    submit: { title: "Mengirim data...", description: "Mohon tunggu hingga data berhasil diterima." },
  },
  en: {
    action: { title: "Processing...", description: "Please wait until the process is complete." },
    guest: { title: "Loading guest list...", description: "Preparing personal links and RSVP data." },
    login: { title: "Signing staff in...", description: "Verifying your account and preparing a secure session." },
    logout: { title: "Ending session...", description: "Closing the staff session securely." },
    refresh: { title: "Refreshing data...", description: "Retrieving the latest information from Niskala." },
    save: { title: "Saving changes...", description: "Please keep this page open until the process is complete." },
    site: { title: "Preparing Niskala...", description: "Composing your invitation experience." },
    submit: { title: "Sending data...", description: "Please wait until the data is received." },
  },
};

const stateCopy: Record<Locale, Record<Exclude<PreloaderState, "loading">, Copy>> = {
  id: {
    error: { title: "Proses gagal.", description: "Silakan periksa keterangan dan coba kembali." },
    offline: { title: "Tidak ada koneksi internet...", description: "Sambungkan perangkat ke internet untuk melanjutkan." },
    slow: { title: "Koneksi internet lemah...", description: "Proses masih berjalan dan mungkin memerlukan waktu lebih lama." },
    success: { title: "Proses berhasil.", description: "Permintaan Anda telah selesai diproses." },
  },
  en: {
    error: { title: "Process failed.", description: "Please review the message and try again." },
    offline: { title: "No internet connection...", description: "Connect this device to the internet to continue." },
    slow: { title: "Weak internet connection...", description: "The process is still running and may take a little longer." },
    success: { title: "Process completed.", description: "Your request has been completed successfully." },
  },
};

export function getPreloaderCopy(
  locale: Locale,
  state: PreloaderState,
  context: PreloaderContext = "action",
): Copy {
  return state === "loading" ? contextCopy[locale][context] : stateCopy[locale][state];
}

function subscribeToConnection(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribeToConnection,
    () => window.navigator.onLine,
    () => true,
  );
}

export function useNetworkAwarePreloaderState(
  active: boolean,
  slowAfterMs = 5_000,
): PreloaderState {
  const online = useOnlineStatus();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const resetTimer = window.setTimeout(() => setSlow(false), 0);
    if (!active || !online) {
      return () => window.clearTimeout(resetTimer);
    }
    const timer = window.setTimeout(() => setSlow(true), slowAfterMs);
    return () => {
      window.clearTimeout(resetTimer);
      window.clearTimeout(timer);
    };
  }, [active, online, slowAfterMs]);

  if (!online) return "offline";
  return slow ? "slow" : "loading";
}

type NiskalaPreloaderProps = {
  compact?: boolean;
  context?: PreloaderContext;
  description?: string;
  locale?: Locale;
  overlay?: boolean;
  state?: PreloaderState;
  title?: string;
};

function LoadingVisual({ state }: { state: PreloaderState }) {
  if (state === "offline") {
    return (
      <Image
        alt=""
        aria-hidden="true"
        className={styles.offlineImage}
        height={1477}
        priority
        src="/preloader/no-connection.png"
        unoptimized
        width={1536}
      />
    );
  }
  if (state === "success" || state === "error") {
    return (
      <div
        aria-hidden="true"
        className={`${styles.resultMark} ${state === "error" ? styles.errorMark : ""}`}
      >
        {state === "success" ? <Check size="1em" /> : <X size="1em" />}
      </div>
    );
  }
  return (
    <div
      aria-hidden="true"
      className={`${styles.visual} ${state === "slow" ? styles.radio : styles.dualBall}`}
    >
      <span />
      <span />
      <span />
    </div>
  );
}

export function NiskalaPreloader({
  compact = false,
  context = "action",
  description,
  locale = "id",
  overlay = false,
  state = "loading",
  title,
}: NiskalaPreloaderProps) {
  const copy = getPreloaderCopy(locale, state, context);
  const className = [
    styles.surface,
    overlay ? styles.overlay : styles.inline,
    compact ? styles.compact : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      aria-live={state === "error" || state === "offline" ? "assertive" : "polite"}
      className={className}
      role={state === "error" || state === "offline" ? "alert" : "status"}
    >
      {!compact ? <p className={styles.brand}>Niskala</p> : null}
      <LoadingVisual state={state} />
      <div className={styles.copy}>
        <p className={styles.title}>{title ?? copy.title}</p>
        <p className={styles.description}>{description ?? copy.description}</p>
      </div>
    </div>
  );
}

export function NetworkAwarePreloader({
  active = true,
  ...props
}: Omit<NiskalaPreloaderProps, "state"> & { active?: boolean }) {
  const state = useNetworkAwarePreloaderState(active);
  return <NiskalaPreloader {...props} state={state} />;
}
