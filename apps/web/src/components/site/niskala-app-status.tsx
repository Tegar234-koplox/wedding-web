"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import type { Locale } from "@/lib/locales";

import {
  NetworkAwarePreloader,
  NiskalaPreloader,
  useOnlineStatus,
} from "./niskala-preloader";

function localeFromPathname(pathname: string): Locale {
  return pathname === "/en" || pathname.startsWith("/en/")
    ? "en"
    : "id";
}

export function NiskalaAppStatus() {
  const pathname = usePathname();
  const [booting, setBooting] = useState(true);
  const online = useOnlineStatus();
  const locale = localeFromPathname(pathname);

  useEffect(() => {
    const timer = window.setTimeout(() => setBooting(false), 650);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }
    void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {
      // Offline fallback is progressive enhancement; normal navigation remains available.
    });
  }, []);

  if (!online) {
    return <NiskalaPreloader locale={locale} overlay state="offline" />;
  }
  if (booting) {
    return <NiskalaPreloader context="site" locale={locale} overlay />;
  }
  return null;
}

export function NiskalaRoutePreloader() {
  const locale = localeFromPathname(usePathname());

  return <NetworkAwarePreloader context="site" locale={locale} overlay />;
}
