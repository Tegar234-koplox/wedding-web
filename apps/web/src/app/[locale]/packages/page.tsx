import { Check, MoveUpRight } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MobileWhatsApp } from "@/components/site/mobile-whatsapp";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { WhatsAppLink } from "@/components/site/whatsapp-link";
import { packages } from "@/content/site";
import { isLocale } from "@/lib/locales";

type PackagesPageProps = {
  params: Promise<{ locale: string }>;
};

export const metadata: Metadata = {
  title: "Packages",
  description: "Compare digital wedding invitation service packages.",
};

export default async function PackagesPage({ params }: PackagesPageProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  const id = locale === "id";

  return (
    <>
      <SiteNav locale={locale} />
      <main>
        <section className="px-[var(--space-gutter)] pb-20 pt-16 md:pb-28 md:pt-24">
          <p className="text-[0.65rem] uppercase tracking-[0.24em] text-[var(--color-gold)]">
            {id ? "Paket Layanan" : "Service Packages"}
          </p>
          <div className="mt-10 grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <h1 className="font-serif text-[clamp(4.5rem,10vw,10rem)] leading-[0.78] tracking-[-0.06em]">
              {id ? "Sesuai kebutuhan," : "Made to fit,"}
              <br />
              <span className="italic text-[var(--color-gold)]">
                {id ? "tetap berkarakter." : "never generic."}
              </span>
            </h1>
            <p className="max-w-md text-sm leading-7 text-[var(--color-muted)]">
              {id
                ? "Semua paket dirancang dengan perhatian yang sama. Perbedaannya ada pada kedalaman cerita, fitur, dan tingkat personalisasi."
                : "Every package receives the same care. The difference lies in storytelling depth, features, and personalization."}
            </p>
          </div>
        </section>

        <section className="px-[var(--space-gutter)] pb-[var(--space-section)]">
          <div className="grid gap-px bg-white/15 lg:grid-cols-3">
            {packages.map((item) => (
              <article
                className={`relative flex min-h-[42rem] flex-col p-7 md:p-9 ${
                  item.featured
                    ? "bg-[var(--color-gold)] text-[#17140d]"
                    : "bg-[var(--color-surface)]"
                }`}
                key={item.code}
              >
                {item.featured ? (
                  <p className="absolute right-6 top-7 text-[0.6rem] uppercase tracking-[0.2em]">
                    {id ? "Paling dipilih" : "Most selected"}
                  </p>
                ) : null}
                <h2 className="font-serif text-5xl">{item.name}</h2>
                <p className="mt-4 text-sm uppercase tracking-[0.18em] opacity-55">
                  {item.price}
                </p>
                <p className="mt-9 min-h-20 max-w-sm text-sm leading-6 opacity-70">
                  {item.description[locale]}
                </p>
                <ul className="mt-8 flex-1 space-y-4 border-t border-current/20 pt-7">
                  {item.features[locale].map((feature) => (
                    <li
                      className="flex items-start gap-3 text-sm"
                      key={feature}
                    >
                      <Check className="mt-0.5 shrink-0" size={15} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <WhatsAppLink
                  className={
                    item.featured
                      ? "border border-black/35 bg-transparent hover:border-black hover:bg-black hover:text-white"
                      : ""
                  }
                  locale={locale}
                  packageCode={item.name}
                  variant={item.featured ? "gold" : "outline"}
                >
                  {id ? "Pilih paket" : "Choose package"}
                  <MoveUpRight size={15} />
                </WhatsAppLink>
              </article>
            ))}
          </div>

          <div className="mt-12 grid gap-7 border-t border-white/15 pt-8 text-sm text-[var(--color-muted)] md:grid-cols-3">
            <p>
              {id
                ? "Harga berlaku untuk satu undangan dan dapat berubah untuk kebutuhan khusus."
                : "Prices cover one invitation and may change for bespoke requirements."}
            </p>
            <p>
              {id
                ? "Pengerjaan normal 5–10 hari kerja setelah materi lengkap diterima."
                : "Typical production takes 5–10 business days after all materials arrive."}
            </p>
            <p>
              {id
                ? "Konsultasikan kebutuhan khusus sebelum memilih paket."
                : "Discuss bespoke requirements with us before selecting a package."}
            </p>
          </div>
        </section>
      </main>
      <SiteFooter locale={locale} />
      <MobileWhatsApp locale={locale} />
    </>
  );
}
