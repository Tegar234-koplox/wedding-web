import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MobileWhatsApp } from "@/components/site/mobile-whatsapp";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { ThemeCard } from "@/components/site/theme-card";
import { getPublicThemes } from "@/content/public-content";
import { isLocale } from "@/lib/locales";

type ThemesPageProps = {
  params: Promise<{ locale: string }>;
};

export const metadata: Metadata = {
  title: "Invitation Themes",
  description: "Explore seven curated digital wedding invitation directions.",
};

export default async function ThemesPage({ params }: ThemesPageProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const id = locale === "id";
  const themes = await getPublicThemes(locale);

  return (
    <>
      <SiteNav locale={locale} />
      <main>
        <section className="px-[var(--space-gutter)] pb-20 pt-16 md:pb-28 md:pt-24">
          <div className="grid gap-10 md:grid-cols-[0.7fr_1.3fr] md:items-end">
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.24em] text-[var(--color-gold)]">
                {id ? "Koleksi 01—07" : "Collection 01—07"}
              </p>
              <p className="mt-8 max-w-xs text-sm leading-6 text-[var(--color-muted)]">
                {id
                  ? "Tujuh arah visual. Masing-masing dapat diisi dengan cerita, foto, dan detail perayaan Anda."
                  : "Seven visual directions. Each can hold your story, photographs, and celebration details."}
              </p>
            </div>
            <h1 className="font-serif text-[clamp(4.5rem,11vw,11rem)] leading-[0.76] tracking-[-0.065em]">
              {id ? "Tema yang" : "Themes with"}
              <br />
              <span className="italic text-[var(--color-gold)]">
                {id ? "punya suasana." : "a point of view."}
              </span>
            </h1>
          </div>
        </section>

        <div className="border-y border-white/10 px-[var(--space-gutter)] py-4">
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-[0.62rem] uppercase tracking-[0.18em] text-[var(--color-muted)]">
            <span>{id ? "Semua tema" : "All themes"}</span>
            <span>{id ? "Klasik" : "Classic"}</span>
            <span>{id ? "Minimal" : "Minimal"}</span>
            <span>{id ? "Dramatis" : "Dramatic"}</span>
            <span>{id ? "Tradisional" : "Traditional"}</span>
          </div>
        </div>

        <section className="px-[var(--space-gutter)] py-[var(--space-section)]">
          <div className="grid gap-x-8 gap-y-20 md:grid-cols-2 lg:grid-cols-3">
            {themes.map((theme, index) => (
              <div
                className={
                  index === 1 || index === 4 ? "lg:translate-y-24" : ""
                }
                key={theme.slug}
              >
                <ThemeCard
                  index={index}
                  locale={locale}
                  priority={index < 3}
                  theme={theme}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[var(--color-gold)] px-[var(--space-gutter)] py-14 text-[#17140d]">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <p className="max-w-2xl font-serif text-3xl md:text-5xl">
              {id
                ? "Belum yakin tema mana yang paling tepat?"
                : "Not sure which direction feels most like you?"}
            </p>
            <Link
              className="border-b border-current pb-2 text-xs uppercase tracking-[0.2em]"
              href={`/${locale}#contact` as const}
            >
              {id ? "Bantu saya memilih" : "Help me choose"}
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter locale={locale} />
      <MobileWhatsApp locale={locale} />
    </>
  );
}
