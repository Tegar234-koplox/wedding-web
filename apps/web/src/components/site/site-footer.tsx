import Link from "next/link";

import type { Locale } from "@/lib/locales";

export function SiteFooter({ locale }: { locale: Locale }) {
  return (
    <footer className="border-t border-white/15 px-[var(--space-gutter)] py-10">
      <div className="grid gap-10 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="font-serif text-4xl">Niskala.</p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--color-muted)]">
            {locale === "id"
              ? "Undangan digital yang dirancang seperti sebuah cerita—personal, intim, dan tak lekang."
              : "Digital invitations designed like a story—personal, intimate, and enduring."}
          </p>
        </div>
        <div className="flex flex-wrap gap-6 text-xs uppercase tracking-[0.18em]">
          <Link href={`/${locale}/themes` as const}>
            {locale === "id" ? "Tema" : "Themes"}
          </Link>
          <Link href={`/${locale}/packages` as const}>
            {locale === "id" ? "Paket" : "Packages"}
          </Link>
          <Link href={`/${locale}#contact` as const}>WhatsApp</Link>
        </div>
      </div>
      <div className="mt-14 flex flex-wrap justify-between gap-3 border-t border-white/10 pt-5 text-[0.65rem] uppercase tracking-[0.16em] text-[var(--color-muted)]">
        <span>© 2026 Niskala Wedding Studio</span>
        <span>Crafted in Indonesia</span>
      </div>
    </footer>
  );
}
