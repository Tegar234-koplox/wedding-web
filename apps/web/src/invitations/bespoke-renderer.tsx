"use client";

import type {
  BespokeConfig,
  InvitationContent,
} from "@wedding/invitation-themes";
import Image from "next/image";
import React, {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import type {
  InvitationAudio,
  InvitationCover,
  InvitationWeather,
} from "@/lib/api/contracts";

import styles from "./bespoke-renderer.module.css";

type Props = {
  invitation: {
    content: InvitationContent;
    locale: "id" | "en";
    guest?: { displayName: string } | null;
  };
  audio?: InvitationAudio | null;
  cover?: InvitationCover;
  rsvpSlot?: ReactNode;
  weather?: InvitationWeather | null;
};

const fontStacks: Record<string, string> = {
  "cormorant-garamond": '"Cormorant Garamond", Georgia, serif',
  "playfair-display": '"Playfair Display", Georgia, serif',
  "bodoni-moda": '"Bodoni Moda", Didot, serif',
  lora: '"Lora", Georgia, serif',
  inter: '"Inter", Arial, sans-serif',
  manrope: '"Manrope", Arial, sans-serif',
};

function documentStyle(
  config: BespokeConfig,
  cover?: InvitationCover,
): CSSProperties {
  return {
    "--bespoke-background": config.tokens.background,
    "--bespoke-surface": config.tokens.surface,
    "--bespoke-text": config.tokens.text,
    "--bespoke-muted": config.tokens.muted,
    "--bespoke-accent": config.tokens.accent,
    "--bespoke-border": config.tokens.border,
    "--bespoke-display-font": fontStacks[config.tokens.displayFont],
    "--bespoke-body-font": fontStacks[config.tokens.bodyFont],
    "--bespoke-focus-x": `${cover?.focal_x ?? 50}%`,
    "--bespoke-focus-y": `${cover?.focal_y ?? 50}%`,
  } as CSSProperties;
}

function CoverSection({
  content,
  cover,
  guestName,
  locale,
  variant,
}: {
  content: InvitationContent;
  cover?: InvitationCover;
  guestName?: string;
  locale: "id" | "en";
  variant: string;
}) {
  const className = variant.includes("cinematic-center")
    ? styles.coverCenter
    : variant.includes("minimal-frame")
      ? styles.coverMinimal
      : styles.coverSplit;
  return (
    <section className={`${styles.cover} ${className}`}>
      <div
        aria-hidden="true"
        className={styles.coverImage}
        style={
          cover ? { backgroundImage: `url("${cover.secure_url}")` } : undefined
        }
      />
      <div className={styles.coverContent}>
        <p className={styles.eyebrow}>{content.opening.eyebrow}</p>
        <h1 className={styles.names}>
          {content.couple.partnerOne}
          <br />
          &amp; {content.couple.partnerTwo}
        </h1>
        <p>{content.opening.message}</p>
        {guestName ? (
          <p className={styles.guestName}>
            {locale === "id" ? "Kepada Yth." : "Dear"} {guestName}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function EventSection({
  content,
  locale,
  variant,
}: {
  content: InvitationContent;
  locale: "id" | "en";
  variant: string;
}) {
  const events = [
    {
      label: content.event.ceremonyLabel,
      time: content.event.ceremonyTime,
      venue: content.event.ceremonyVenue || content.event.venue,
      address: content.event.ceremonyAddress || content.event.address,
      map: content.event.ceremonyMapUrl || content.event.mapUrl,
    },
    {
      label: content.event.receptionLabel,
      time: content.event.receptionTime,
      venue: content.event.receptionVenue || content.event.venue,
      address: content.event.receptionAddress || content.event.address,
      map: content.event.receptionMapUrl || content.event.mapUrl,
    },
  ];
  return (
    <section className={styles.section}>
      <p className={styles.eyebrow}>{content.event.dateLabel}</p>
      <div
        className={`${styles.grid} ${styles.twoColumns}`}
        style={{ marginTop: "2.5rem" }}
        data-variant={variant}
      >
        {events.map((event) => (
          <article className={styles.card} key={event.label}>
            <p className={styles.eyebrow}>{event.time}</p>
            <h3>{event.label}</h3>
            <p>{event.venue}</p>
            <p>{event.address}</p>
            <a href={event.map} rel="noreferrer" target="_blank">
              {locale === "id" ? "Buka peta" : "Open map"}
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

function StorySection({
  content,
  variant,
}: {
  content: InvitationContent;
  variant: string;
}) {
  return (
    <section
      className={`${styles.section} ${variant.includes("manifesto") ? styles.storyManifesto : ""}`}
    >
      <p className={styles.eyebrow}>{content.story.heading}</p>
      <h2 className={styles.heading}>{content.opening.title}</h2>
      <p className={styles.body}>{content.story.body}</p>
    </section>
  );
}

function TimelineSection({
  content,
  locale,
  variant,
}: {
  content: InvitationContent;
  locale: "id" | "en";
  variant: string;
}) {
  const entries = Object.values(content.timeline || {}).flat();
  return (
    <section className={styles.section}>
      <p className={styles.eyebrow}>
        {locale === "id" ? "Linimasa" : "Timeline"}
      </p>
      <h2 className={styles.heading}>
        {locale === "id" ? "Bab perjalanan kami" : "Our chapters"}
      </h2>
      <div
        className={`${styles.timeline} ${variant.includes("horizontal") ? styles.timelineHorizontal : ""}`}
      >
        {entries.map((entry, index) => (
          <article key={`${entry.number}-${index}`}>
            <p className={styles.eyebrow}>{entry.number}</p>
            <h3>{entry.title}</h3>
            <p className={styles.body}>{entry.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function GallerySection({
  content,
  section,
}: {
  content: InvitationContent;
  section: BespokeConfig["sections"][number];
}) {
  const start = section.mediaStart || 0;
  const photos = content.gallery.slice(
    start,
    start + (section.mediaCount || content.gallery.length),
  );
  return (
    <section className={styles.section}>
      <div
        className={`${styles.gallery} ${section.variant.includes("film-strip") ? styles.filmStrip : ""}`}
      >
        {photos.map((photo, index) => (
          <figure className={styles.photo} key={`${photo.src}-${index}`}>
            <Image
              alt={photo.alt}
              fill
              sizes="(max-width: 720px) 50vw, 33vw"
              src={photo.src}
            />
          </figure>
        ))}
      </div>
    </section>
  );
}

function QuoteSection({ content }: { content: InvitationContent }) {
  return (
    <section className={`${styles.section} ${styles.quote}`}>
      <blockquote>{content.quote.text}</blockquote>
      <p className={styles.eyebrow} style={{ marginTop: "2rem" }}>
        {content.quote.attribution}
      </p>
    </section>
  );
}

function GiftSection({
  content,
  locale,
}: {
  content: InvitationContent;
  locale: "id" | "en";
}) {
  if (!content.bank_accounts?.length) return null;
  return (
    <section className={styles.section}>
      <p className={styles.eyebrow}>
        {locale === "id" ? "Hadiah pernikahan" : "Wedding gift"}
      </p>
      <div className={`${styles.grid} ${styles.twoColumns}`}>
        {content.bank_accounts.map((account, index) => (
          <article className={styles.card} key={`${account.bank}-${index}`}>
            <h3>{account.bank}</h3>
            <p>{account.account_number || account.number}</p>
            <p>{account.name}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function WeatherSection({
  weather,
  locale,
}: {
  weather?: InvitationWeather | null;
  locale: "id" | "en";
}) {
  if (!weather?.selected) return null;
  return (
    <section className={styles.section}>
      <p className={styles.eyebrow}>{locale === "id" ? "Cuaca" : "Weather"}</p>
      <h2 className={styles.heading}>{weather.selected.temperature_c}°C</h2>
      <p className={styles.body}>{weather.selected.description[locale]}</p>
    </section>
  );
}

export function BespokeRenderer({
  invitation,
  audio,
  cover,
  rsvpSlot,
  weather,
}: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const config = invitation.content.bespoke;

  useEffect(() => {
    const element = audioRef.current;
    if (!element || !audio) return;
    element.volume = audio.default_volume;
    return () => {
      element.pause();
    };
  }, [audio]);

  async function toggleAudio() {
    const element = audioRef.current;
    if (!element) return;
    if (element.paused) {
      try {
        await element.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    } else {
      element.pause();
      setPlaying(false);
    }
  }

  if (!config) return null;
  const { content } = invitation;
  return (
    <article
      className={styles.document}
      data-intensity={config.motion.intensity}
      data-motion={config.motion.preset}
      data-radius={config.tokens.radius}
      data-spacing={config.tokens.spacing}
      style={documentStyle(config, cover)}
    >
      {config.sections
        .filter((section) => section.enabled)
        .map((section) => {
          switch (section.type) {
            case "cover":
              return (
                <CoverSection
                  content={content}
                  cover={cover}
                  guestName={invitation.guest?.displayName}
                  key={section.id}
                  locale={invitation.locale}
                  variant={section.variant}
                />
              );
            case "event":
              return (
                <EventSection
                  content={content}
                  key={section.id}
                  locale={invitation.locale}
                  variant={section.variant}
                />
              );
            case "story":
              return (
                <StorySection
                  content={content}
                  key={section.id}
                  variant={section.variant}
                />
              );
            case "timeline":
              return (
                <TimelineSection
                  content={content}
                  key={section.id}
                  locale={invitation.locale}
                  variant={section.variant}
                />
              );
            case "gallery":
              return (
                <GallerySection
                  content={content}
                  key={section.id}
                  section={section}
                />
              );
            case "quote":
              return <QuoteSection content={content} key={section.id} />;
            case "rsvp":
              return rsvpSlot ? (
                <section className={styles.section} key={section.id}>
                  {rsvpSlot}
                </section>
              ) : null;
            case "gift":
              return (
                <GiftSection
                  content={content}
                  key={section.id}
                  locale={invitation.locale}
                />
              );
            case "weather":
              return (
                <WeatherSection
                  key={section.id}
                  locale={invitation.locale}
                  weather={weather}
                />
              );
            case "closing":
              return (
                <section
                  className={`${styles.section} ${styles.closing}`}
                  key={section.id}
                >
                  <p className={styles.eyebrow}>{content.closing.heading}</p>
                  <h2 className={styles.heading}>
                    {content.couple.partnerOne} &amp;{" "}
                    {content.couple.partnerTwo}
                  </h2>
                  <p className={styles.body}>{content.closing.message}</p>
                </section>
              );
          }
        })}
      {audio ? (
        <>
          <audio
            loop={audio.loop}
            onEnded={() => setPlaying(false)}
            preload="none"
            ref={audioRef}
            src={audio.secure_url}
          />
          <button
            aria-label={
              invitation.locale === "id"
                ? playing
                  ? "Jeda musik"
                  : "Putar musik"
                : playing
                  ? "Pause music"
                  : "Play music"
            }
            className={styles.audioControl}
            onClick={toggleAudio}
            type="button"
          >
            <span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span>
            <span>{audio.title}</span>
          </button>
        </>
      ) : null}
    </article>
  );
}
