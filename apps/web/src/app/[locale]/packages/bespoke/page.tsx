import { Check, Gem } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BespokeLink } from "@/components/site/bespoke-link";
import { MobileWhatsApp } from "@/components/site/mobile-whatsapp";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { packages } from "@/content/site";
import { isLocale } from "@/lib/locales";
import { createWhatsAppUrl } from "@/lib/whatsapp";

import styles from "./bespoke.module.css";

type BespokePageProps = {
  params: Promise<{ locale: string }>;
};

export const metadata: Metadata = {
  title: "Bespoke Wedding Invitation",
  description:
    "A fully custom digital wedding invitation shaped around a dedicated creative brief.",
};

export default async function BespokePage({ params }: BespokePageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }

  const id = locale === "id";
  const bespoke = packages.find((item) => item.code === "bespoke");
  if (!bespoke) {
    notFound();
  }

  return (
    <>
      <SiteNav locale={locale} />
      <main className={styles.page}>
        <section className="px-[var(--space-gutter)] pb-20 pt-16 md:pb-28 md:pt-24">
          <div className="mx-auto max-w-6xl text-center">
            <p className="text-[0.65rem] uppercase tracking-[0.28em] text-[#d8ad58]">
              {id ? "Undangan Full Custom" : "Fully Custom Invitation"}
            </p>
            <h1
              className={`${styles.display} mt-7 text-[clamp(5rem,14vw,12rem)] leading-[0.75] text-[#f5ead5]`}
            >
              Bespoke
            </h1>
            <p className="mx-auto mt-9 max-w-2xl text-sm leading-7 text-white/58 md:text-base">
              {bespoke.description[locale]}
            </p>
          </div>

          <article className={`${styles.card} mt-16 md:mt-24`}>
            <div className="grid gap-10 border-b border-[#d8ad58]/25 pb-10 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <div className="flex items-center gap-3 text-[#d8ad58]">
                  <Gem aria-hidden="true" size={18} />
                  <p className="text-[0.62rem] uppercase tracking-[0.24em]">
                    {id
                      ? "Dibangun khusus untuk Anda"
                      : "Built uniquely for you"}
                  </p>
                </div>
                <h2
                  className={`${styles.display} mt-6 text-5xl text-[#f5ead5] md:text-7xl`}
                >
                  {id ? "Satu perayaan," : "One celebration,"}
                  <br />
                  <span className="italic text-[#d8ad58]">
                    {id ? "satu arah visual." : "one visual language."}
                  </span>
                </h2>
              </div>
              <div className="lg:text-right">
                <p className="text-[0.6rem] uppercase tracking-[0.2em] text-white/42">
                  {id ? "Investasi mulai" : "Investment starts at"}
                </p>
                <p className={`${styles.display} mt-3 text-4xl text-[#f5ead5]`}>
                  Rp 849k
                </p>
              </div>
            </div>

            <ul className="grid gap-x-12 md:grid-cols-2">
              {bespoke.features[locale].map((feature) => (
                <li
                  className="flex min-h-20 items-center gap-4 border-b border-white/10 py-5 text-sm leading-6 text-white/72"
                  key={feature}
                >
                  <Check className="shrink-0 text-[#d8ad58]" size={16} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <p className="max-w-2xl text-xs leading-6 text-white/42">
                {id
                  ? "Harga akhir mengikuti kompleksitas brief. Ilustrasi khusus, aset berlisensi, custom domain, dan integrasi eksternal dihitung terpisah setelah ruang lingkup disepakati."
                  : "Final pricing follows the brief complexity. Custom illustration, licensed assets, custom domains, and external integrations are quoted separately after scope approval."}
              </p>
              <BespokeLink
                external
                href={createWhatsAppUrl({ locale, packageCode: "Bespoke" })}
              >
                {id ? "Putuskan" : "Decide"}
              </BespokeLink>
            </div>
          </article>

          <div className={`${styles.rule} mx-auto mt-20 h-px max-w-4xl`} />
        </section>
      </main>
      <SiteFooter locale={locale} />
      <MobileWhatsApp locale={locale} />
    </>
  );
}
