"use client";

import { packageCodes, type PackageCode } from "@wedding/invitation-themes";
import { ExternalLink, Monitor, Smartphone } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";

import type { Locale } from "@/lib/locales";
import { cn } from "@/lib/utils";
import { WhatsAppLink } from "@/components/site/whatsapp-link";

type PreviewFrameProps = {
  locale: Locale;
  slug: string;
  title: string;
};

export function PreviewFrame({ locale, slug, title }: PreviewFrameProps) {
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [packageCode, setPackageCode] = useState<PackageCode>("signature");
  const previewUrl =
    `/${locale}/preview/${slug}?package=${packageCode}` as Route;

  return (
    <section className="bg-[#0d0d0c] px-[var(--space-gutter)] py-[var(--space-section)] text-[var(--color-ink)]">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[0.62rem] uppercase tracking-[0.22em] text-[var(--color-gold)]">
              {locale === "id" ? "Preview interaktif" : "Interactive preview"}
            </p>
            <h2 className="mt-4 font-serif text-4xl md:text-6xl">
              {locale === "id" ? "Lihat dalam konteks." : "See it in context."}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              aria-label={locale === "id" ? "Tampilan ponsel" : "Mobile view"}
              className={cn(
                "grid size-11 place-items-center border transition",
                device === "mobile"
                  ? "border-[var(--color-gold)] text-[var(--color-gold)]"
                  : "border-white/15 text-white/55 hover:border-white/40",
              )}
              onClick={() => setDevice("mobile")}
              type="button"
            >
              <Smartphone size={17} />
            </button>
            <button
              aria-label={locale === "id" ? "Tampilan desktop" : "Desktop view"}
              className={cn(
                "grid size-11 place-items-center border transition",
                device === "desktop"
                  ? "border-[var(--color-gold)] text-[var(--color-gold)]"
                  : "border-white/15 text-white/55 hover:border-white/40",
              )}
              onClick={() => setDevice("desktop")}
              type="button"
            >
              <Monitor size={18} />
            </button>
            <Link
              aria-label={
                locale === "id"
                  ? "Buka preview di tab baru"
                  : "Open preview in a new tab"
              }
              className="grid size-11 place-items-center border border-white/15 text-white/55 transition hover:border-white/40 hover:text-white"
              href={previewUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              <ExternalLink size={17} />
            </Link>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-y border-white/10 py-4">
          <div className="flex flex-wrap gap-1">
            {packageCodes.map((item) => (
              <button
                aria-pressed={packageCode === item}
                className={cn(
                  "min-h-10 px-4 text-[0.6rem] font-semibold uppercase tracking-[0.18em] transition",
                  packageCode === item
                    ? "bg-[var(--color-gold)] text-[#17140d]"
                    : "border border-white/15 text-white/60 hover:text-white",
                )}
                key={item}
                onClick={() => setPackageCode(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
          <WhatsAppLink
            locale={locale}
            packageCode={packageCode}
            theme={title}
            variant="text"
          >
            {locale === "id" ? "Konsultasi paket ini" : "Consult this package"}
          </WhatsAppLink>
        </div>

        <div className="grid min-h-[46rem] place-items-center overflow-hidden border border-white/10 bg-[#1b1b19] p-3 md:p-8">
          <div
            className={cn(
              "h-[42rem] overflow-hidden bg-white shadow-2xl transition-[width,border-radius] duration-500",
              device === "mobile"
                ? "w-[min(100%,23.5rem)] rounded-[2rem] border-[0.45rem] border-[#292927]"
                : "w-full max-w-6xl rounded-sm border border-white/10",
            )}
          >
            <iframe
              allow="autoplay"
              className="size-full bg-white"
              key={`${slug}-${packageCode}`}
              loading="lazy"
              sandbox="allow-scripts allow-same-origin"
              src={`${previewUrl}#embed`}
              title={`${title} invitation preview`}
            />
          </div>
        </div>

        <p className="mt-5 text-center text-[0.62rem] uppercase tracking-[0.18em] text-white/40">
          {locale === "id"
            ? "Scroll di dalam perangkat untuk melihat seluruh undangan"
            : "Scroll inside the device to explore the full invitation"}
        </p>
      </div>
    </section>
  );
}
