"use client";

import { ArrowLeft } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useSyncExternalStore } from "react";

type PreviewBackButtonProps = {
  href: Route;
  label: string;
};

export function PreviewBackButton({ href, label }: PreviewBackButtonProps) {
  const embedded = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("hashchange", onStoreChange);
      return () => window.removeEventListener("hashchange", onStoreChange);
    },
    () => window.location.hash === "#embed",
    () => true,
  );

  if (embedded) {
    return null;
  }

  return (
    <div className="fixed left-4 top-4 z-[100]">
      <Link
        className="inline-flex min-h-11 items-center gap-3 bg-black/75 px-4 text-[0.62rem] uppercase tracking-[0.18em] text-white backdrop-blur-md transition hover:bg-black"
        href={href}
      >
        <ArrowLeft size={14} />
        {label}
      </Link>
    </div>
  );
}
