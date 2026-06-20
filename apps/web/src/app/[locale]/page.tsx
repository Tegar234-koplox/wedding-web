import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { isLocale } from "@/lib/locales";

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

export const metadata: Metadata = {
  title: "Foundation",
};

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const copy =
    locale === "id"
      ? {
          eyebrow: "Studio Undangan Pernikahan",
          title: "Sesuatu yang indah sedang dirangkai.",
          body: "Fondasi teknis telah siap. Pengalaman editorial lengkap akan hadir pada fase berikutnya.",
          switchLabel: "English",
        }
      : {
          eyebrow: "Wedding Invitation Studio",
          title: "Something beautiful is taking shape.",
          body: "The technical foundation is ready. The full editorial experience arrives in the next phase.",
          switchLabel: "Bahasa Indonesia",
        };
  const switchHref = locale === "id" ? ("/en" as const) : ("/id" as const);

  return (
    <main className="grid min-h-screen content-between gap-16 px-[var(--space-gutter)] py-8">
      <header className="flex items-center justify-between border-b border-[var(--color-rule)] pb-5 text-sm uppercase tracking-[0.18em]">
        <span>Wedding Invitation Studio</span>
        <Link href={switchHref}>{copy.switchLabel}</Link>
      </header>

      <section className="max-w-5xl py-[var(--space-section)]">
        <p className="mb-8 text-sm uppercase tracking-[0.28em] text-[var(--color-gold)]">
          {copy.eyebrow}
        </p>
        <h1 className="max-w-4xl font-serif text-[clamp(3.5rem,10vw,9rem)] leading-[0.88] tracking-[-0.045em]">
          {copy.title}
        </h1>
        <p className="mt-10 max-w-xl leading-8 text-[var(--color-muted)]">
          {copy.body}
        </p>
      </section>

      <footer className="border-t border-[var(--color-rule)] pt-5 text-sm text-[var(--color-muted)]">
        Phase 1 · Foundation
      </footer>
    </main>
  );
}
