"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { Locale } from "@/lib/locales";
import { cn } from "@/lib/utils";

type SiteNavProps = {
  locale: Locale;
  inverted?: boolean;
};

export function SiteNav({ locale, inverted = false }: SiteNavProps) {
  const [open, setOpen] = useState(false);
  const firstMobileLink = useRef<HTMLAnchorElement>(null);
  const otherLocale = locale === "id" ? "en" : "id";
  const labels =
    locale === "id"
      ? {
          themes: "Tema",
          packages: "Paket",
          process: "Proses",
          contact: "Konsultasi",
        }
      : {
          themes: "Themes",
          packages: "Packages",
          process: "Process",
          contact: "Consult",
        };
  const links = [
    { href: `/${locale}/themes` as const, label: labels.themes },
    { href: `/${locale}/packages` as const, label: labels.packages },
    { href: `/${locale}#process` as const, label: labels.process },
    { href: `/${locale}#contact` as const, label: labels.contact },
  ];

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstMobileLink.current?.focus();

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <header
      className={cn(
        "relative z-50 flex h-20 items-center justify-between border-b px-[var(--space-gutter)]",
        inverted
          ? "border-black/15 text-[#171511]"
          : "border-white/15 text-[var(--color-ink)]",
      )}
    >
      <Link
        className="font-serif text-xl tracking-[-0.02em]"
        href={`/${locale}` as const}
      >
        Niskala<span className="text-[var(--color-gold)]">.</span>
      </Link>

      <nav
        aria-label={locale === "id" ? "Navigasi utama" : "Primary navigation"}
        className="hidden items-center gap-8 md:flex"
      >
        {links.map((link) => (
          <Link
            className="text-[0.7rem] font-medium uppercase tracking-[0.2em] transition hover:text-[var(--color-gold)]"
            href={link.href}
            key={link.href}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="hidden items-center gap-5 md:flex">
        <Link
          className="text-[0.65rem] font-semibold uppercase tracking-[0.2em]"
          href={`/${otherLocale}` as const}
        >
          {otherLocale.toUpperCase()}
        </Link>
        <span className="h-4 w-px bg-current opacity-25" />
        <span className="text-[0.65rem] uppercase tracking-[0.2em]">
          Est. 2026
        </span>
      </div>

      <button
        aria-controls="mobile-navigation"
        aria-expanded={open}
        aria-label={
          open
            ? locale === "id"
              ? "Tutup menu"
              : "Close menu"
            : locale === "id"
              ? "Buka menu"
              : "Open menu"
        }
        className="grid size-11 place-items-center md:hidden"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {open ? <X aria-hidden size={21} /> : <Menu aria-hidden size={21} />}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="fixed inset-x-0 top-20 z-40 min-h-[calc(100dvh-5rem)] bg-[var(--color-canvas)] px-[var(--space-gutter)] py-12 text-[var(--color-ink)] md:hidden"
            exit={{ opacity: 0, y: -20 }}
            initial={{ opacity: 0, y: -20 }}
            id="mobile-navigation"
            transition={{ duration: 0.25 }}
          >
            <nav
              aria-label={
                locale === "id" ? "Navigasi seluler" : "Mobile navigation"
              }
              className="grid gap-2"
              onClick={() => setOpen(false)}
            >
              {links.map((link, index) => (
                <Link
                  className="border-b border-white/15 py-5 font-serif text-4xl"
                  href={link.href}
                  key={link.href}
                  ref={index === 0 ? firstMobileLink : undefined}
                >
                  <span className="mr-4 align-middle font-sans text-[0.65rem] text-[var(--color-gold)]">
                    0{index + 1}
                  </span>
                  {link.label}
                </Link>
              ))}
              <Link
                className="mt-8 text-sm uppercase tracking-[0.2em]"
                href={`/${otherLocale}` as const}
              >
                {otherLocale === "id" ? "Bahasa Indonesia" : "English"}
              </Link>
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
