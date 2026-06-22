import { ArrowDown, ArrowRight, CloudSun, MoveUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { MobileWhatsApp } from "@/components/site/mobile-whatsapp";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteNav } from "@/components/site/site-nav";
import { ThemeCard } from "@/components/site/theme-card";
import { WhatsAppLink } from "@/components/site/whatsapp-link";
import { packages, themes } from "@/content/site";
import type { Locale } from "@/lib/locales";

export function EditorialHome({ locale }: { locale: Locale }) {
  const id = locale === "id";

  return (
    <>
      <SiteNav locale={locale} />

      <main>
        <section
          className="relative min-h-[calc(100svh-5rem)] overflow-hidden px-[var(--space-gutter)] pb-12 pt-10 md:pb-16 md:pt-14"
          data-hero
        >
          <div className="pointer-events-none absolute right-[-5vw] top-[4vh] h-[72vh] w-[58vw] min-w-[34rem] opacity-90 max-md:right-[-44vw] max-md:top-[16vh] max-md:h-[62vh] max-md:w-[100vw] max-md:min-w-0">
            <div className="absolute inset-0 overflow-hidden" data-hero-image>
              <Image
                alt="Editorial portrait of an Indonesian wedding couple"
                className="object-cover object-center"
                fill
                priority
                sizes="(max-width: 767px) 100vw, 60vw"
                src="/images/hero-editorial.webp"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-canvas)] via-transparent to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-canvas)] via-transparent to-transparent" />
            </div>
          </div>

          <div className="relative z-10 grid min-h-[calc(100svh-10rem)] content-between">
            <div className="flex items-start justify-between">
              <p
                className="max-w-[14rem] text-[0.65rem] uppercase leading-5 tracking-[0.22em] text-[var(--color-gold-soft)]"
                data-hero-detail
              >
                {id ? "Selamanya Dimulai Hari ini." : "Forever Begins Today."}
              </p>
              <p
                className="hidden text-right text-[0.6rem] uppercase leading-5 tracking-[0.22em] text-white/50 md:block"
                data-hero-detail
              >
                Sidoarjo · Indonesia
                <br />
                Available Worldwide
              </p>
            </div>

            <div className="relative py-20 md:py-12">
              <div className="overflow-hidden">
                <p
                  className="font-serif text-[clamp(4.7rem,12.5vw,12rem)] leading-[0.72] tracking-[-0.07em]"
                  data-hero-line
                >
                  Love
                </p>
              </div>
              <div className="overflow-hidden md:pl-[15vw]">
                <p
                  className="font-serif text-[clamp(4.7rem,12.5vw,12rem)] italic leading-[0.86] tracking-[-0.07em] text-[var(--color-gold)]"
                  data-hero-line
                >
                  Begins
                </p>
              </div>
              <div className="overflow-hidden">
                <p
                  className="font-serif text-[clamp(4.7rem,12.5vw,12rem)] leading-[0.76] tracking-[-0.07em]"
                  data-hero-line
                >
                  Here.
                </p>
              </div>
            </div>

            <div className="grid items-end gap-8 md:grid-cols-[1fr_auto_1fr]">
              <div data-hero-detail>
                <WhatsAppLink locale={locale}>
                  {id ? "Mulai konsultasi" : "Start a consultation"}
                  <MoveUpRight size={15} />
                </WhatsAppLink>
              </div>
              <a
                className="hidden animate-bounce items-center gap-3 text-[0.6rem] uppercase tracking-[0.2em] text-white/55 md:flex"
                data-hero-detail
                href="#themes"
              >
                <ArrowDown size={14} />
                {id ? "Jelajahi" : "Explore"}
              </a>
              <p
                className="max-w-sm text-sm leading-6 text-[var(--color-muted)] md:justify-self-end"
                data-hero-detail
              >
                {id
                  ? "Kami merancang ruang digital yang terasa seperti Anda—dengan ritme, detail, dan atmosfer yang pantas dikenang."
                  : "We create digital spaces that feel unmistakably yours—with rhythm, detail, and atmosphere worth remembering."}
              </p>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-[var(--color-gold)] px-[var(--space-gutter)] py-5 text-[#17140d]">
          <div className="flex flex-wrap items-center justify-between gap-4 text-[0.65rem] font-semibold uppercase tracking-[0.2em]">
            <span>{id ? "Desain Personal" : "Personal Design"}</span>
            <span>·</span>
            <span>{id ? "Prakiraan Cuaca BMKG" : "BMKG Weather Forecast"}</span>
            <span>·</span>
            <span>
              {id ? "Responsif di Semua Layar" : "Responsive on Every Screen"}
            </span>
            <span>·</span>
            <span>{id ? "Dukungan WhatsApp" : "WhatsApp Support"}</span>
          </div>
        </section>

        <section
          className="px-[var(--space-gutter)] py-[var(--space-section)]"
          id="themes"
        >
          <div className="mb-16 grid gap-8 md:grid-cols-[0.8fr_1.2fr] md:items-end">
            <p
              className="text-[0.65rem] uppercase tracking-[0.24em] text-[var(--color-gold)]"
              data-reveal
            >
              01 — {id ? "Koleksi Tema" : "Theme Collection"}
            </p>
            <div data-reveal>
              <h2 className="max-w-4xl font-serif text-[var(--text-heading)] leading-[0.92] tracking-[-0.045em]">
                {id ? "Pilih atmosfer," : "Choose an atmosphere,"}
                <br />
                <span className="italic text-[var(--color-gold)]">
                  {id ? "bukan sekadar warna." : "not merely a color."}
                </span>
              </h2>
            </div>
          </div>

          <div className="grid gap-x-7 gap-y-16 md:grid-cols-2 lg:grid-cols-3">
            {themes.slice(0, 6).map((theme, index) => (
              <div
                className={
                  index === 1 || index === 4 ? "lg:translate-y-20" : ""
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

          <div className="mt-24 flex justify-end" data-reveal>
            <Link
              className="inline-flex items-center gap-4 border-b border-[var(--color-gold)] pb-3 text-xs uppercase tracking-[0.2em]"
              href={`/${locale}/themes` as const}
            >
              {id ? "Lihat seluruh koleksi" : "View the full collection"}
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#d7cbb6] px-[var(--space-gutter)] py-[var(--space-section)] text-[#18150f]">
          <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div data-reveal>
              <p className="text-[0.65rem] uppercase tracking-[0.24em]">
                02 — {id ? "Lebih dari undangan" : "More than an invitation"}
              </p>
              <h2 className="mt-8 max-w-xl font-serif text-[var(--text-heading)] leading-[0.92] tracking-[-0.045em]">
                {id ? "Hari Anda," : "Your day,"}
                <br />
                <span className="italic text-[#6b191e]">
                  {id ? "dalam satu alur." : "in one graceful flow."}
                </span>
              </h2>
              <p className="mt-8 max-w-lg text-base leading-7 text-black/65">
                {id
                  ? "Tamu menemukan jadwal, lokasi, cerita, galeri, RSVP, hingga cuaca hari pernikahan—tanpa kehilangan keindahan dari pengalaman itu sendiri."
                  : "Guests discover your schedule, location, story, gallery, RSVP, and wedding-day weather—without sacrificing the beauty of the experience."}
              </p>
            </div>

            <div className="grid gap-px bg-black/15 sm:grid-cols-2" data-reveal>
              {[
                ["01", id ? "Cerita personal" : "A personal story"],
                ["02", id ? "Informasi yang jelas" : "Clear information"],
                ["03", id ? "Cuaca dari BMKG" : "Weather by BMKG"],
                ["04", id ? "Siap dibagikan" : "Ready to share"],
              ].map(([number, label]) => (
                <div className="min-h-44 bg-[#d7cbb6] p-6" key={number}>
                  <span className="text-xs text-[#6b191e]">{number}</span>
                  <p className="mt-16 font-serif text-2xl">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          className="px-[var(--space-gutter)] py-[var(--space-section)]"
          id="process"
        >
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <div data-reveal>
              <p className="text-[0.65rem] uppercase tracking-[0.24em] text-[var(--color-gold)]">
                03 — {id ? "Cara kami bekerja" : "How we work"}
              </p>
              <h2 className="mt-8 font-serif text-[var(--text-heading)] leading-[0.92] tracking-[-0.045em]">
                {id ? "Sederhana." : "Simple."}
                <br />
                <span className="italic text-[var(--color-gold)]">
                  {id ? "Tetap personal." : "Still personal."}
                </span>
              </h2>
            </div>

            <ol className="border-t border-white/15">
              {[
                [
                  id ? "Pilih arah visual" : "Choose your direction",
                  id
                    ? "Temukan tema yang paling dekat dengan suasana perayaan Anda."
                    : "Find the theme closest to the atmosphere of your celebration.",
                ],
                [
                  id ? "Kirim cerita Anda" : "Share your story",
                  id
                    ? "Berikan detail acara, foto, musik, dan hal-hal kecil yang bermakna."
                    : "Send your event details, photos, music, and meaningful little things.",
                ],
                [
                  id ? "Kami merangkainya" : "We craft it",
                  id
                    ? "Tim kami menata konten, memoles detail, dan mengirim tautan untuk ditinjau."
                    : "We compose the content, refine every detail, and send a review link.",
                ],
                [
                  id ? "Bagikan hari bahagia" : "Share the celebration",
                  id
                    ? "Setelah disetujui, undangan siap dibagikan kepada orang-orang terdekat."
                    : "Once approved, your invitation is ready for everyone you love.",
                ],
              ].map(([title, body], index) => (
                <li
                  className="grid gap-5 border-b border-white/15 py-8 sm:grid-cols-[5rem_1fr] md:grid-cols-[7rem_0.8fr_1.2fr]"
                  data-reveal
                  key={title}
                >
                  <span className="text-xs text-[var(--color-gold)]">
                    0{index + 1}
                  </span>
                  <h3 className="font-serif text-2xl">{title}</h3>
                  <p className="max-w-md text-sm leading-6 text-[var(--color-muted)]">
                    {body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-y border-white/10 bg-[var(--color-surface)] px-[var(--space-gutter)] py-[var(--space-section)]">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.2fr]">
            <div
              className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden"
              data-reveal
            >
              <Image
                alt="Dark cinematic invitation theme"
                className="object-cover"
                data-parallax
                fill
                sizes="(max-width: 1023px) 90vw, 40vw"
                src="/images/themes/dark-cinematic.webp"
              />
            </div>
            <div data-reveal>
              <CloudSun className="text-[var(--color-gold)]" size={34} />
              <p className="mt-8 text-[0.65rem] uppercase tracking-[0.24em] text-[var(--color-gold)]">
                {id ? "Cuaca hari pernikahan" : "Wedding-day weather"}
              </p>
              <h2 className="mt-6 max-w-2xl font-serif text-[var(--text-heading)] leading-[0.92] tracking-[-0.045em]">
                {id ? "Satu detail kecil," : "One small detail,"}
                <br />
                <span className="italic">
                  {id ? "sangat membantu tamu." : "genuinely useful."}
                </span>
              </h2>
              <p className="mt-8 max-w-xl text-base leading-7 text-[var(--color-muted)]">
                {id
                  ? "Setiap undangan Signature dan Couture menampilkan prakiraan cuaca resmi BMKG ketika hari acara memasuki jangkauan prakiraan."
                  : "Every Signature and Couture invitation shows the official BMKG forecast once the event enters the available forecast window."}
              </p>
              <p className="mt-6 text-xs uppercase tracking-[0.16em] text-white/45">
                Data cuaca: BMKG ·{" "}
                {id ? "Diperbarui otomatis" : "Updated automatically"}
              </p>
            </div>
          </div>
        </section>

        <section className="px-[var(--space-gutter)] py-[var(--space-section)]">
          <div className="mb-14 flex flex-wrap items-end justify-between gap-8">
            <div data-reveal>
              <p className="text-[0.65rem] uppercase tracking-[0.24em] text-[var(--color-gold)]">
                04 — {id ? "Paket layanan" : "Service packages"}
              </p>
              <h2 className="mt-7 font-serif text-[var(--text-heading)] leading-none">
                {id ? "Mulai dari sini." : "Begin here."}
              </h2>
            </div>
            <Link
              className="inline-flex items-center gap-3 text-xs uppercase tracking-[0.2em]"
              href={`/${locale}/packages` as const}
            >
              {id ? "Bandingkan paket" : "Compare packages"}
              <ArrowRight size={15} />
            </Link>
          </div>

          <div className="grid gap-px bg-white/15 lg:grid-cols-3" data-reveal>
            {packages.map((item) => (
              <article
                className={`relative min-h-[30rem] p-7 ${
                  item.featured
                    ? "bg-[var(--color-gold)] text-[#17140d]"
                    : "bg-[var(--color-canvas)]"
                }`}
                key={item.code}
              >
                {item.featured ? (
                  <span className="absolute right-5 top-5 text-[0.6rem] uppercase tracking-[0.2em]">
                    {id ? "Paling dipilih" : "Most selected"}
                  </span>
                ) : null}
                <p className="font-serif text-4xl">{item.name}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.18em] opacity-60">
                  {item.price}
                </p>
                <p className="mt-9 max-w-xs text-sm leading-6 opacity-70">
                  {item.description[locale]}
                </p>
                <ul className="mt-10 space-y-3 text-sm">
                  {item.features[locale].slice(0, 4).map((feature) => (
                    <li
                      className="border-t border-current/20 pt-3"
                      key={feature}
                    >
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section
          className="relative overflow-hidden bg-[#681920] px-[var(--space-gutter)] py-[var(--space-section)]"
          id="contact"
        >
          <span className="pointer-events-none absolute -right-10 -top-20 font-serif text-[18rem] leading-none text-black/10">
            &
          </span>
          <div className="relative grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div data-reveal>
              <p className="text-[0.65rem] uppercase tracking-[0.24em] text-white/65">
                {id
                  ? "Ceritakan rencana Anda"
                  : "Tell us what you are planning"}
              </p>
              <h2 className="mt-8 max-w-4xl font-serif text-[clamp(4rem,9vw,9rem)] leading-[0.82] tracking-[-0.06em]">
                {id ? "Mari menebar" : "Let us make"}
                <br />
                <span className="italic text-[var(--color-gold-soft)]">
                  {id ? "agar tak memudar." : "something felt."}
                </span>
              </h2>
            </div>
            <div className="lg:pb-3" data-reveal>
              <p className="mb-8 max-w-sm text-sm leading-6 text-white/70">
                {id
                  ? "Konsultasi awal tanpa biaya. Ceritakan tanggal, lokasi, dan suasana yang Anda bayangkan."
                  : "Your first consultation is complimentary. Tell us the date, location, and atmosphere you imagine."}
              </p>
              <WhatsAppLink locale={locale} variant="outline">
                {id ? "Konsultasi via WhatsApp" : "Consult via WhatsApp"}
                <MoveUpRight size={15} />
              </WhatsAppLink>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} />
      <MobileWhatsApp locale={locale} />
    </>
  );
}
