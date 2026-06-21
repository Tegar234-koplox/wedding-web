import type {
  InvitationEnvelope,
  RendererKey,
} from "@wedding/invitation-themes";
import {
  CalendarDays,
  CloudRain,
  CloudSun,
  Droplets,
  MapPin,
  Wind,
} from "lucide-react";
import Image from "next/image";
import type { ComponentType } from "react";

import type { InvitationWeather } from "@/lib/api/contracts";

type RendererProps = {
  invitation: InvitationEnvelope;
  weather?: InvitationWeather | null;
};

type Design = {
  key: RendererKey;
  page: string;
  surface: string;
  muted: string;
  accent: string;
  display: string;
  coverImage: string;
  coverMode: "split" | "center" | "image" | "minimal";
  ornament?: string;
};

const designs: Record<RendererKey, Design> = {
  "elegant-classic": {
    key: "elegant-classic",
    page: "bg-[#eee8dd] text-[#171510]",
    surface: "bg-[#171510] text-[#eee8dd]",
    muted: "text-[#6c675f]",
    accent: "text-[#765d32]",
    display: "font-serif",
    coverImage: "/images/themes/elegant-classic.webp",
    coverMode: "split",
    ornament: "✦",
  },
  "islamic-soft": {
    key: "islamic-soft",
    page: "bg-[#edf0e7] text-[#263029]",
    surface: "bg-[#dce2d5] text-[#263029]",
    muted: "text-[#687369]",
    accent: "text-[#8f794b]",
    display: "font-serif",
    coverImage: "/images/themes/islamic-soft.webp",
    coverMode: "center",
    ornament: "◇",
  },
  "luxury-gold": {
    key: "luxury-gold",
    page: "bg-[#0b0a08] text-[#e4c779]",
    surface: "bg-[#15120d] text-[#ead9aa]",
    muted: "text-[#9e947b]",
    accent: "text-[#d2ad55]",
    display: "font-serif",
    coverImage: "/images/themes/luxury-gold.webp",
    coverMode: "split",
    ornament: "◆",
  },
  "minimalist-white": {
    key: "minimalist-white",
    page: "bg-[#f6f5f1] text-[#161616]",
    surface: "bg-[#e8e7e2] text-[#161616]",
    muted: "text-[#6f6f6b]",
    accent: "text-[#161616]",
    display: "font-sans",
    coverImage: "/images/themes/minimalist-white.webp",
    coverMode: "minimal",
    ornament: "·",
  },
  "dark-cinematic": {
    key: "dark-cinematic",
    page: "bg-[#0b0909] text-[#eee8df]",
    surface: "bg-[#4d1016] text-[#f2e8dc]",
    muted: "text-[#a9a19a]",
    accent: "text-[#a73a42]",
    display: "font-serif",
    coverImage: "/images/hero-editorial.webp",
    coverMode: "image",
    ornament: "×",
  },
  "floral-romantic": {
    key: "floral-romantic",
    page: "bg-[#ead9d5] text-[#4c3135]",
    surface: "bg-[#a96f77] text-[#fff7ef]",
    muted: "text-[#7d5b60]",
    accent: "text-[#8d4f59]",
    display: "font-serif",
    coverImage: "/images/themes/floral-romantic.webp",
    coverMode: "split",
    ornament: "❦",
  },
  "javanese-traditional": {
    key: "javanese-traditional",
    page: "bg-[#2a2118] text-[#ead9b7]",
    surface: "bg-[#b7945c] text-[#241a12]",
    muted: "text-[#b8a98d]",
    accent: "text-[#d2aa6b]",
    display: "font-serif",
    coverImage: "/images/themes/javanese-traditional.webp",
    coverMode: "center",
    ornament: "ꦿ",
  },
};

function CoupleNames({
  invitation,
  design,
}: RendererProps & { design: Design }) {
  const { partnerOne, partnerTwo } = invitation.content.couple;

  return (
    <h1
      className={`${design.display} text-[clamp(4rem,12vw,10rem)] leading-[0.78] tracking-[-0.06em]`}
    >
      <span className="block">{partnerOne}</span>
      <span className={`block italic ${design.accent}`}>&amp;</span>
      <span className="block">{partnerTwo}</span>
    </h1>
  );
}

function Cover({ invitation, design }: RendererProps & { design: Design }) {
  const { opening, event, couple } = invitation.content;

  if (design.coverMode === "image") {
    return (
      <section className="relative grid min-h-svh content-between overflow-hidden px-6 py-8 text-white md:px-12 md:py-12">
        <Image
          alt={`Portrait of ${couple.partnerOne} and ${couple.partnerTwo}`}
          className="object-cover object-center"
          fill
          priority
          sizes="100vw"
          src={design.coverImage}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-black/35" />
        <div className="relative flex justify-between text-[0.6rem] uppercase tracking-[0.22em]">
          <span>{opening.eyebrow}</span>
          <span>{event.dateLabel}</span>
        </div>
        <div className="relative max-w-5xl pb-8">
          <CoupleNames design={design} invitation={invitation} />
          <p className="mt-10 max-w-md text-sm leading-6 text-white/70">
            {opening.message}
          </p>
        </div>
      </section>
    );
  }

  if (design.coverMode === "minimal") {
    return (
      <section className="grid min-h-svh grid-rows-[auto_1fr_auto] px-6 py-8 md:px-14 md:py-12">
        <div className="flex justify-between border-b border-current/20 pb-5 text-[0.58rem] uppercase tracking-[0.24em]">
          <span>{opening.eyebrow}</span>
          <span>{couple.monogram}</span>
        </div>
        <div className="grid items-center gap-10 py-16 lg:grid-cols-[1.2fr_0.8fr]">
          <CoupleNames design={design} invitation={invitation} />
          <div>
            <p className="text-sm uppercase tracking-[0.18em]">
              {event.dateLabel}
            </p>
            <p className={`mt-6 max-w-sm text-sm leading-7 ${design.muted}`}>
              {opening.message}
            </p>
          </div>
        </div>
        <div className="relative h-[28vh] min-h-52 overflow-hidden">
          <Image
            alt="Minimal invitation detail"
            className="object-cover"
            fill
            priority
            sizes="100vw"
            src={design.coverImage}
          />
        </div>
      </section>
    );
  }

  if (design.coverMode === "center") {
    return (
      <section className="relative grid min-h-svh place-items-center overflow-hidden px-6 py-14 text-center">
        <div className="absolute inset-0 opacity-20">
          <Image
            alt=""
            className="object-cover"
            fill
            priority
            sizes="100vw"
            src={design.coverImage}
          />
        </div>
        <div className="absolute inset-5 border border-current/20 md:inset-10" />
        <div className="relative max-w-4xl">
          <p className={`text-3xl ${design.accent}`} aria-hidden>
            {design.ornament}
          </p>
          <p className="mt-8 text-[0.62rem] uppercase tracking-[0.28em]">
            {opening.eyebrow}
          </p>
          <div className="mt-14">
            <CoupleNames design={design} invitation={invitation} />
          </div>
          <p className="mt-12 text-xs uppercase tracking-[0.22em]">
            {event.dateLabel}
          </p>
          <p
            className={`mx-auto mt-8 max-w-lg text-sm leading-7 ${design.muted}`}
          >
            {opening.message}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="grid min-h-svh lg:grid-cols-[1.05fr_0.95fr]">
      <div className="flex flex-col justify-between px-6 py-10 md:px-12 md:py-14">
        <div className="flex justify-between text-[0.6rem] uppercase tracking-[0.22em]">
          <span>{opening.eyebrow}</span>
          <span>{design.ornament}</span>
        </div>
        <div className="py-20">
          <CoupleNames design={design} invitation={invitation} />
          <p className={`mt-10 max-w-md text-sm leading-7 ${design.muted}`}>
            {opening.message}
          </p>
        </div>
        <p className="text-xs uppercase tracking-[0.2em]">{event.dateLabel}</p>
      </div>
      <div className="relative min-h-[65svh] overflow-hidden lg:min-h-svh">
        <Image
          alt={`Invitation style for ${couple.partnerOne} and ${couple.partnerTwo}`}
          className="object-cover"
          fill
          priority
          sizes="(max-width: 1023px) 100vw, 48vw"
          src={design.coverImage}
        />
      </div>
    </section>
  );
}

function EventSection({
  invitation,
  design,
}: RendererProps & { design: Design }) {
  const { event } = invitation.content;
  const id = invitation.locale === "id";

  return (
    <section className={`${design.surface} px-6 py-24 md:px-12 md:py-36`}>
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-[0.62rem] uppercase tracking-[0.26em] opacity-65">
          {id ? "Waktu & tempat" : "Time & place"}
        </p>
        <h2
          className={`${design.display} mx-auto mt-8 max-w-4xl text-center text-[clamp(3rem,8vw,7rem)] leading-[0.88] tracking-[-0.05em]`}
        >
          {event.dateLabel}
        </h2>
        <div className="mt-20 grid gap-px bg-current/20 md:grid-cols-3">
          <div className={`${design.surface} p-7`}>
            <CalendarDays size={20} />
            <p className="mt-10 text-xs uppercase tracking-[0.18em] opacity-55">
              {event.ceremonyLabel}
            </p>
            <p className={`${design.display} mt-3 text-3xl`}>
              {event.ceremonyTime}
            </p>
          </div>
          <div className={`${design.surface} p-7`}>
            <CalendarDays size={20} />
            <p className="mt-10 text-xs uppercase tracking-[0.18em] opacity-55">
              {event.receptionLabel}
            </p>
            <p className={`${design.display} mt-3 text-3xl`}>
              {event.receptionTime}
            </p>
          </div>
          <div className={`${design.surface} p-7`}>
            <MapPin size={20} />
            <p className="mt-10 text-xs uppercase tracking-[0.18em] opacity-55">
              {event.venue}
            </p>
            <p className="mt-3 text-sm leading-6 opacity-75">{event.address}</p>
            <a
              className="mt-6 inline-block border-b border-current pb-1 text-[0.62rem] uppercase tracking-[0.18em]"
              href={event.mapUrl}
              rel="noreferrer"
              target="_blank"
            >
              {id ? "Buka peta" : "Open map"}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function StorySection({
  invitation,
  design,
}: RendererProps & { design: Design }) {
  const { story, quote, gallery } = invitation.content;

  return (
    <>
      <section className="px-6 py-24 md:px-12 md:py-36">
        <div className="mx-auto grid max-w-6xl gap-16 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className={`text-4xl ${design.accent}`} aria-hidden>
              {design.ornament}
            </p>
            <h2
              className={`${design.display} mt-8 text-[clamp(3rem,7vw,6rem)] leading-[0.9] tracking-[-0.045em]`}
            >
              {story.heading}
            </h2>
          </div>
          <div className="lg:pt-20">
            <p className={`max-w-2xl text-lg leading-9 ${design.muted}`}>
              {story.body}
            </p>
            <blockquote className="mt-16 border-l border-current/30 pl-7">
              <p className={`${design.display} text-2xl italic leading-9`}>
                “{quote.text}”
              </p>
              <footer className="mt-5 text-[0.62rem] uppercase tracking-[0.2em] opacity-55">
                {quote.attribution}
              </footer>
            </blockquote>
          </div>
        </div>
      </section>

      <section className="grid gap-2 px-2 md:grid-cols-12">
        {gallery.map((image, index) => (
          <div
            className={`relative min-h-[55svh] overflow-hidden ${
              index === 0 ? "md:col-span-7" : "md:col-span-5"
            } ${index === 2 ? "md:col-span-12 md:min-h-[75svh]" : ""}`}
            key={`${image.src}-${index}`}
          >
            <Image
              alt={image.alt}
              className="object-cover"
              fill
              sizes={index === 2 ? "100vw" : "(max-width: 767px) 100vw, 58vw"}
              src={image.src}
            />
          </div>
        ))}
      </section>
    </>
  );
}

function WeatherSection({
  invitation,
  design,
  weather,
}: RendererProps & { design: Design }) {
  const id = invitation.locale === "id";
  const selected = weather?.selected;
  const isAvailable =
    weather?.status === "ready" || weather?.status === "stale";

  if (isAvailable && selected) {
    const description = selected.description[invitation.locale];
    const isRain = selected.precipitation_mm > 0.4;
    const updatedLabel = weather.updated_at
      ? new Intl.DateTimeFormat(
          invitation.locale === "id" ? "id-ID" : "en-US",
          {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: weather.location?.timezone || "Asia/Jakarta",
          },
        ).format(new Date(weather.updated_at))
      : "";

    return (
      <section className="px-6 py-24 md:px-12 md:py-32">
        <div className="mx-auto max-w-5xl border-y border-current/20 py-12">
          <div className="grid gap-12 md:grid-cols-[0.8fr_1.2fr] md:items-end">
            <div>
              {isRain ? (
                <CloudRain className={design.accent} size={36} />
              ) : (
                <CloudSun className={design.accent} size={36} />
              )}
              <p className="mt-7 text-[0.62rem] uppercase tracking-[0.24em] opacity-55">
                {id ? "Prakiraan hari pernikahan" : "Wedding-day forecast"}
              </p>
              <h2 className={`${design.display} mt-5 text-5xl md:text-7xl`}>
                {description}
              </h2>
              <p className={`mt-4 text-sm ${design.muted}`}>
                {weather.location?.village}, {weather.location?.regency}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-px bg-current/20">
              <div className={`${design.page} p-5`}>
                <p className={`${design.display} text-3xl`}>
                  {selected.temperature_c}°
                </p>
                <p className="mt-3 text-[0.55rem] uppercase tracking-[0.16em] opacity-55">
                  Celsius
                </p>
              </div>
              <div className={`${design.page} p-5`}>
                <Droplets size={18} />
                <p className="mt-4 text-lg">{selected.humidity_percent}%</p>
                <p className="mt-2 text-[0.55rem] uppercase tracking-[0.16em] opacity-55">
                  {id ? "Kelembapan" : "Humidity"}
                </p>
              </div>
              <div className={`${design.page} p-5`}>
                <Wind size={18} />
                <p className="mt-4 text-lg">{selected.wind.speed_kmh} km/h</p>
                <p className="mt-2 text-[0.55rem] uppercase tracking-[0.16em] opacity-55">
                  {id ? "Angin" : "Wind"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap justify-between gap-4 border-t border-current/15 pt-5 text-[0.58rem] uppercase tracking-[0.16em] opacity-55">
            <a
              className="underline underline-offset-4"
              href={weather.attribution_url}
              rel="noreferrer"
              target="_blank"
            >
              Data cuaca: BMKG
            </a>
            <span>
              {weather.status === "stale"
                ? id
                  ? "Data tersimpan · pembaruan tertunda"
                  : "Saved data · refresh delayed"
                : `${id ? "Diperbarui" : "Updated"} ${updatedLabel}`}
            </span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-6 py-24 md:px-12 md:py-32">
      <div className="mx-auto max-w-4xl border-y border-current/20 py-12 text-center">
        <CloudSun className={`mx-auto ${design.accent}`} size={30} />
        <p className="mt-7 text-[0.62rem] uppercase tracking-[0.24em] opacity-55">
          {id ? "Cuaca hari pernikahan" : "Wedding-day weather"}
        </p>
        <h2 className={`${design.display} mt-5 text-4xl md:text-6xl`}>
          {id
            ? "Tersedia mendekati hari acara"
            : "Available closer to the date"}
        </h2>
        <p
          className={`mx-auto mt-6 max-w-xl text-sm leading-7 ${design.muted}`}
        >
          {weather?.reason === "provider_unavailable"
            ? id
              ? "Layanan cuaca sedang tidak tersedia. Silakan periksa kembali beberapa saat lagi."
              : "Weather information is temporarily unavailable. Please check again shortly."
            : id
              ? "Prakiraan resmi BMKG akan tampil ketika tanggal pernikahan memasuki jangkauan prakiraan tiga hari."
              : "The official BMKG forecast will appear when the wedding enters the three-day forecast window."}
        </p>
        <a
          className="mt-7 inline-block text-[0.58rem] uppercase tracking-[0.18em] opacity-45 underline underline-offset-4"
          href={
            weather?.attribution_url ??
            "https://data.bmkg.go.id/prakiraan-cuaca/"
          }
          rel="noreferrer"
          target="_blank"
        >
          Data cuaca: BMKG
        </a>
      </div>
    </section>
  );
}

function Closing({ invitation, design }: RendererProps & { design: Design }) {
  const { closing, couple } = invitation.content;

  return (
    <section
      className={`${design.surface} grid min-h-[80svh] place-items-center px-6 py-24 text-center`}
    >
      <div className="max-w-4xl">
        <p className="text-4xl opacity-60" aria-hidden>
          {design.ornament}
        </p>
        <h2
          className={`${design.display} mt-10 text-[clamp(4rem,10vw,9rem)] leading-[0.85] tracking-[-0.055em]`}
        >
          {closing.heading}
        </h2>
        <p className="mx-auto mt-10 max-w-lg text-sm leading-7 opacity-70">
          {closing.message}
        </p>
        <p
          className={`${design.display} mt-16 text-2xl italic tracking-[-0.02em]`}
        >
          {couple.partnerOne} &amp; {couple.partnerTwo}
        </p>
      </div>
    </section>
  );
}

function InvitationDocument({
  invitation,
  design,
  weather,
}: RendererProps & { design: Design }) {
  return (
    <article className={`${design.page} min-h-screen`}>
      <Cover design={design} invitation={invitation} />
      <EventSection design={design} invitation={invitation} />
      <StorySection design={design} invitation={invitation} />
      <WeatherSection
        design={design}
        invitation={invitation}
        weather={weather}
      />
      <Closing design={design} invitation={invitation} />
    </article>
  );
}

function createRenderer(key: RendererKey): ComponentType<RendererProps> {
  function RegisteredRenderer(props: RendererProps) {
    return <InvitationDocument design={designs[key]} {...props} />;
  }

  RegisteredRenderer.displayName = `${key}-renderer-v1`;
  return RegisteredRenderer;
}

export const rendererRegistry: Record<
  RendererKey,
  Record<number, ComponentType<RendererProps>>
> = {
  "elegant-classic": { 1: createRenderer("elegant-classic") },
  "islamic-soft": { 1: createRenderer("islamic-soft") },
  "luxury-gold": { 1: createRenderer("luxury-gold") },
  "minimalist-white": { 1: createRenderer("minimalist-white") },
  "dark-cinematic": { 1: createRenderer("dark-cinematic") },
  "floral-romantic": { 1: createRenderer("floral-romantic") },
  "javanese-traditional": { 1: createRenderer("javanese-traditional") },
};

export function InvitationRenderer({ invitation, weather }: RendererProps) {
  const Renderer =
    rendererRegistry[invitation.rendererKey]?.[invitation.rendererVersion];

  if (!Renderer) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#11110f] px-6 text-center text-[#f4efe5]">
        <div className="max-w-xl">
          <p className="text-xs uppercase tracking-[0.22em] text-[#d5ad55]">
            Renderer unavailable
          </p>
          <h1 className="mt-6 font-serif text-5xl">
            This invitation version cannot be displayed.
          </h1>
          <p className="mt-6 text-sm leading-7 text-[#b9b1a3]">
            The invitation data is safe, but its presentation version is not
            installed in this release.
          </p>
        </div>
      </main>
    );
  }

  return <Renderer invitation={invitation} weather={weather} />;
}
