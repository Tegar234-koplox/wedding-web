import { ArrowLeft, MoveUpRight } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MobileWhatsApp } from "@/components/site/mobile-whatsapp";
import { PreviewFrame } from "@/components/site/preview-frame";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { WhatsAppLink } from "@/components/site/whatsapp-link";
import { getPublicThemes } from "@/content/public-content";
import { getTheme, themes } from "@/content/site";
import { isLocale, locales } from "@/lib/locales";

type ThemePageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    themes.map((theme) => ({ locale, slug: theme.slug })),
  );
}

export async function generateMetadata({
  params,
}: ThemePageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const theme = getTheme(slug);

  if (!theme || !isLocale(locale)) {
    return {};
  }

  return {
    title: theme.name[locale],
    description: theme.description[locale],
  };
}

export default async function ThemePage({ params }: ThemePageProps) {
  const { locale, slug } = await params;

  if (!isLocale(locale)) {
    notFound();
  }
  const theme =
    (await getPublicThemes(locale)).find((item) => item.slug === slug) ||
    getTheme(slug);

  if (!theme) {
    notFound();
  }

  const id = locale === "id";

  return (
    <>
      <SiteNav locale={locale} />
      <main>
        <section className="grid min-h-[calc(100svh-5rem)] lg:grid-cols-[0.92fr_1.08fr]">
          <div className="relative min-h-[58svh] overflow-hidden lg:order-2 lg:min-h-0">
            <Image
              alt={`${theme.name[locale]} invitation theme`}
              className="object-cover"
              fill
              priority
              sizes="(max-width: 1023px) 100vw, 55vw"
              src={theme.image}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
            <span className="absolute bottom-6 right-6 text-[0.6rem] uppercase tracking-[0.2em] text-white/65">
              Editorial direction · 01
            </span>
          </div>

          <div className="flex flex-col justify-between px-[var(--space-gutter)] py-12 lg:order-1 lg:py-16">
            <Link
              className="inline-flex items-center gap-3 text-[0.65rem] uppercase tracking-[0.18em] text-[var(--color-muted)]"
              href={`/${locale}/themes` as const}
            >
              <ArrowLeft size={14} />
              {id ? "Semua tema" : "All themes"}
            </Link>

            <div className="my-20 lg:my-10">
              <p
                className="text-[0.65rem] uppercase tracking-[0.22em]"
                style={{ color: theme.accent }}
              >
                {theme.category[locale]}
              </p>
              <h1 className="mt-7 max-w-2xl font-serif text-[clamp(4.5rem,8vw,8rem)] leading-[0.8] tracking-[-0.06em]">
                {theme.name[locale]}
              </h1>
              <p className="mt-10 max-w-lg text-base leading-7 text-[var(--color-muted)]">
                {theme.description[locale]}
              </p>
            </div>

            <div className="grid gap-8 border-t border-white/15 pt-8 sm:grid-cols-2">
              <div>
                <p className="text-[0.6rem] uppercase tracking-[0.18em] text-white/45">
                  {id ? "Cocok untuk" : "Made for"}
                </p>
                <p className="mt-3 text-sm leading-6">
                  {id
                    ? "Pasangan yang ingin undangannya terasa personal, terarah, dan berbeda."
                    : "Couples who want an invitation that feels personal, intentional, and distinct."}
                </p>
              </div>
              <div className="grid gap-3 self-end">
                <Link
                  className="inline-flex min-h-12 items-center justify-center gap-3 border border-white/25 px-5 text-xs font-semibold uppercase tracking-[0.18em] transition hover:border-[var(--color-gold)]"
                  href={`/${locale}/preview/${slug}` as const}
                  target="_blank"
                >
                  {id ? "Buka live preview" : "Open live preview"}
                  <MoveUpRight size={15} />
                </Link>
                <WhatsAppLink locale={locale} theme={theme.name[locale]}>
                  {id ? "Pilih tema ini" : "Choose this theme"}
                  <MoveUpRight size={15} />
                </WhatsAppLink>
              </div>
            </div>
          </div>
        </section>

        <PreviewFrame locale={locale} slug={slug} title={theme.name[locale]} />

        <section className="border-y border-white/10 bg-[var(--color-surface)] px-[var(--space-gutter)] py-14">
          <div className="grid gap-8 text-sm md:grid-cols-4">
            {[
              id
                ? "Responsive mobile & desktop"
                : "Responsive mobile & desktop",
              id ? "Musik & galeri" : "Music & gallery",
              id ? "Lokasi & RSVP" : "Location & RSVP",
              id ? "Cuaca Open-Meteo*" : "Open-Meteo weather*",
            ].map((feature, index) => (
              <div
                className="border-l border-[var(--color-gold)] pl-4"
                key={feature}
              >
                <span className="text-[0.6rem] text-white/40">
                  0{index + 1}
                </span>
                <p className="mt-3">{feature}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-[0.65rem] text-white/35">
            *{" "}
            {id
              ? "Tersedia pada paket tertentu."
              : "Available on selected packages."}
          </p>
        </section>
      </main>
      <SiteFooter locale={locale} />
      <MobileWhatsApp locale={locale} />
    </>
  );
}
