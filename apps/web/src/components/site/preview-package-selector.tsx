"use client";

import { packageCodes, type PackageCode } from "@wedding/invitation-themes";
import { Eye, EyeOff, MessageCircle } from "lucide-react";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import React, { useState } from "react";

import { createWhatsAppUrl } from "@/lib/whatsapp";
import type { Locale } from "@/lib/locales";
import { cn } from "@/lib/utils";

type PreviewPackageSelectorProps = {
  locale: Locale;
  selected: PackageCode;
  theme: string;
};

export function PreviewPackageSelector({
  locale,
  selected,
  theme,
}: PreviewPackageSelectorProps) {
  const [controlsVisible, setControlsVisible] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  function selectPackage(packageCode: PackageCode) {
    router.replace(`${pathname}?package=${packageCode}` as Route, {
      scroll: false,
    });
  }

  return (
    <div
      className={cn(
        "fixed z-[60] text-white transition-all duration-300",
        controlsVisible
          ? "inset-x-3 bottom-3 mx-auto flex max-w-xl flex-wrap items-center justify-center gap-1 border border-white/15 bg-black/80 p-2 shadow-2xl backdrop-blur-md md:inset-x-auto md:bottom-auto md:right-5 md:top-1/2 md:max-w-none md:-translate-y-1/2 md:flex-col md:gap-2"
          : "bottom-3 right-3 grid border border-white/15 bg-black/80 p-2 shadow-2xl backdrop-blur-md md:bottom-auto md:right-5 md:top-1/2 md:-translate-y-1/2",
      )}
    >
      <div
        className={controlsVisible ? "contents" : "hidden"}
        id="preview-package-controls"
      >
        {packageCodes.map((packageCode) => (
          <button
            aria-pressed={selected === packageCode}
            className={cn(
              "min-h-10 px-4 text-[0.6rem] font-semibold uppercase tracking-[0.18em] transition md:min-w-32",
              selected === packageCode
                ? "bg-[#d5ad55] text-[#17140d]"
                : "hover:bg-white/10",
            )}
            key={packageCode}
            onClick={() => selectPackage(packageCode)}
            type="button"
          >
            {packageCode}
          </button>
        ))}
        <a
          aria-label={
            locale === "id"
              ? "Konsultasi tema dan paket ini melalui WhatsApp"
              : "Consult about this theme and package via WhatsApp"
          }
          className="grid size-10 place-items-center border border-white/20 text-[#d5ad55] transition hover:border-[#d5ad55]"
          href={createWhatsAppUrl({
            locale,
            theme,
            packageCode: selected,
          })}
          rel="noopener noreferrer"
          target="_blank"
        >
          <MessageCircle size={16} />
        </a>
      </div>
      <button
        aria-controls="preview-package-controls"
        aria-expanded={controlsVisible}
        aria-label={
          locale === "id"
            ? controlsVisible
              ? "Sembunyikan kontrol live preview"
              : "Tampilkan kontrol live preview"
            : controlsVisible
              ? "Hide live preview controls"
              : "Show live preview controls"
        }
        className="grid size-10 shrink-0 place-items-center border border-white/20 text-white/70 transition hover:border-[#d5ad55] hover:text-[#d5ad55]"
        onClick={() => setControlsVisible((visible) => !visible)}
        type="button"
      >
        {controlsVisible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
