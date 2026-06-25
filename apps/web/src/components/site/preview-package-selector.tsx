"use client";

import { packageCodes, type PackageCode } from "@wedding/invitation-themes";
import { MessageCircle } from "lucide-react";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";

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
  const pathname = usePathname();
  const router = useRouter();

  function selectPackage(packageCode: PackageCode) {
    router.replace(`${pathname}?package=${packageCode}` as Route, {
      scroll: false,
    });
  }

  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto flex max-w-xl flex-wrap items-center justify-center gap-1 border border-white/15 bg-black/80 p-2 text-white shadow-2xl backdrop-blur-md">
      {packageCodes.map((packageCode) => (
        <button
          aria-pressed={selected === packageCode}
          className={cn(
            "min-h-10 px-4 text-[0.6rem] font-semibold uppercase tracking-[0.18em] transition",
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
  );
}
