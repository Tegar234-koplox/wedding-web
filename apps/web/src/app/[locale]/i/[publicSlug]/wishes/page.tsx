import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { fetchInvitationWishes } from "@/lib/api/public";
import { isLocale } from "@/lib/locales";

type InvitationWishesPageProps = {
  params: Promise<{ locale: string; publicSlug: string }>;
  searchParams?: Promise<{ access?: string }>;
};

function rsvpLabel(status: string, locale: string): string {
  if (status === "accepted") {
    return locale === "id" ? "Hadir" : "Attending";
  }
  if (status === "declined") {
    return locale === "id" ? "Tidak hadir" : "Not attending";
  }
  return locale === "id" ? "Belum RSVP" : "Pending";
}

function formatRespondedAt(value: string | null, locale: string): string {
  if (!value) {
    return locale === "id" ? "Belum ada waktu" : "No timestamp";
  }
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export async function generateMetadata({
  params,
  searchParams,
}: InvitationWishesPageProps): Promise<Metadata> {
  const { locale, publicSlug } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) {
    return {};
  }
  const payload = await fetchInvitationWishes(publicSlug, query?.access);
  if (!payload) {
    return {};
  }
  return {
    title: `Ucapan tamu - ${payload.couple_name}`,
    robots: { index: false, follow: false },
  };
}

export default async function InvitationWishesPage({
  params,
  searchParams,
}: InvitationWishesPageProps) {
  const { locale, publicSlug } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) {
    notFound();
  }

  const payload = await fetchInvitationWishes(publicSlug, query?.access);
  if (!payload) {
    notFound();
  }

  const copy = {
    eyebrow: locale === "id" ? "RSVP & UCAPAN" : "RSVP & WISHES",
    title: locale === "id" ? "Ucapan tamu." : "Guest wishes.",
    subtitle:
      locale === "id"
        ? "Rekap khusus untuk pengantin. Link ini tidak membutuhkan login, jadi simpan dan bagikan dengan hati-hati."
        : "A private recap for the couple. This link does not require login, so keep it shared carefully.",
    invited: locale === "id" ? "Tamu" : "Guests",
    attending: locale === "id" ? "Hadir" : "Attending",
    declined: locale === "id" ? "Tidak hadir" : "Declined",
    response: locale === "id" ? "Respons" : "Response",
    empty:
      locale === "id"
        ? "Belum ada ucapan yang masuk."
        : "No guest wishes have been submitted yet.",
    attendance: locale === "id" ? "jumlah hadir" : "attending",
  };

  return (
    <main className="min-h-screen bg-[#090907] px-5 py-10 text-white sm:px-8 lg:px-14">
      <section className="mx-auto flex max-w-6xl flex-col gap-10">
        <header className="grid gap-8 border-b border-white/10 pb-10 lg:grid-cols-[1fr_0.8fr] lg:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.45em] text-[var(--color-gold)]">
              {copy.eyebrow}
            </p>
            <h1 className="mt-8 max-w-3xl font-serif text-5xl leading-none text-[#f8f3ea] sm:text-7xl">
              {copy.title}
            </h1>
            <p className="mt-5 text-lg font-semibold text-white/85">{payload.couple_name}</p>
          </div>
          <p className="max-w-xl text-sm leading-7 text-white/60">{copy.subtitle}</p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [copy.invited, payload.total_invited],
            [copy.attending, payload.total_confirmed],
            [copy.declined, payload.total_declined],
            [copy.response, `${payload.response_rate}%`],
          ].map(([label, value]) => (
            <article className="border border-white/10 bg-white/[0.03] p-5" key={label}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/40">
                {label}
              </p>
              <p className="mt-4 font-serif text-3xl text-[#f8f3ea]">{value}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-4">
          {payload.wishes.length === 0 ? (
            <div className="border border-white/10 bg-white/[0.03] p-6 text-sm text-white/55">
              {copy.empty}
            </div>
          ) : null}

          {payload.wishes.map((wish, index) => (
            <article
              className="border border-white/10 bg-white/[0.03] p-5 sm:p-6"
              key={`${wish.display_name}-${wish.responded_at ?? index}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-serif text-2xl text-[#f8f3ea]">{wish.display_name}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--color-gold)]">
                    {rsvpLabel(wish.rsvp_status, locale)}
                    {wish.attendance_count ? ` / ${wish.attendance_count} ${copy.attendance}` : ""}
                  </p>
                </div>
                <p className="text-xs text-white/35">
                  {formatRespondedAt(wish.responded_at, locale)}
                </p>
              </div>
              <p className="mt-5 max-w-3xl text-base leading-8 text-white/72">{wish.wishes}</p>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
