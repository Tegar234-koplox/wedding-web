"use client";

import { useSyncExternalStore } from "react";

const grantByPathname = new Map<string, string>();

function subscribeToHashChange(onStoreChange: () => void): () => void {
  window.addEventListener("hashchange", onStoreChange);
  return () => window.removeEventListener("hashchange", onStoreChange);
}

function grantSnapshot(): string {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const grant = params.get("grant") ?? "";
  const pathname = window.location.pathname;
  if (grant) {
    grantByPathname.set(pathname, grant);
    window.history.replaceState(
      window.history.state,
      "",
      `${pathname}${window.location.search}`,
    );
  }
  return grantByPathname.get(pathname) ?? "";
}

function serverGrantSnapshot(): string {
  return "";
}

export function consumeGrantFragment(pathname?: string): void {
  const target =
    pathname ??
    (typeof window === "undefined" ? "" : window.location.pathname);
  if (target) {
    grantByPathname.delete(target);
  }
}

export function useGrantFragment(): string {
  return useSyncExternalStore(
    subscribeToHashChange,
    grantSnapshot,
    serverGrantSnapshot,
  );
}
