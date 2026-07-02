"use client";

import {
  packageCapabilities,
  type InvitationEnvelope,
  type PackageCode,
} from "@wedding/invitation-themes";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  CalendarDays,
  MapPin,
  Music2,
  Pause,
  Play,
  Volume2,
} from "lucide-react";
import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";

import {
  getPremiumVisualConfig,
  themeVisualConfig,
  type PremiumVisualConfig,
  type ThemeVisual,
} from "@/invitations/presentation";
import {
  CoverTextContrastLayer,
  ThemeCoverDecoration,
  ThemeSectionDecoration,
} from "@/invitations/theme-ornament";
import { ThemedWeather } from "@/invitations/themed-weather";
import type { InvitationAudio, InvitationWeather } from "@/lib/api/contracts";

export type RendererV2Props = {
  invitation: InvitationEnvelope;
  packageCode?: PackageCode;
  audio?: InvitationAudio | null;
  weather?: InvitationWeather | null;
};

function Cover({
  invitation,
  packageCode,
  design,
  onOpen,
  audioAvailable,
  premium,
}: RendererV2Props & {
  design: ThemeVisual;
  onOpen: () => void;
  audioAvailable: boolean;
  premium: PremiumVisualConfig;
}) {
  const { couple, event, opening } = invitation.content;
  const resolvedPackage = packageCode ?? "essential";
  const capability = packageCapabilities[resolvedPackage];
  const couture = resolvedPackage === "couture";
  const id = invitation.locale === "id";

  return (
    <motion.section
      className={`fixed inset-0 z-50 grid min-h-svh overflow-hidden ${design.page}`}
      exit={{ opacity: 0, scale: 1.025 }}
      transition={{ duration: couture ? 1.15 : 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      <Image
        alt={`Wedding cover for ${couple.partnerOne} and ${couple.partnerTwo}`}
        className="object-cover"
        fill
        priority
        sizes="100vw"
        src={design.coverImage}
      />
      <div
        className={`absolute inset-0 ${design.overlay} ${
          capability.overlay === "restrained"
            ? "opacity-70"
            : capability.overlay === "layered"
              ? "opacity-100"
              : "opacity-90"
        }`}
      />
      <ThemeCoverDecoration config={premium} />
      <CoverTextContrastLayer config={premium} />
      <div className="absolute inset-5 border border-current/25 md:inset-9" />

      <div className="relative z-10 grid min-h-svh grid-rows-[auto_1fr_auto] px-7 pb-24 pt-7 sm:pb-28 md:px-14 md:py-12">
        <div className="flex justify-between text-[0.58rem] uppercase tracking-[0.24em]">
          <span>{opening.eyebrow}</span>
          <span>{event.dateLabel}</span>
        </div>

        <div
          className={`grid content-center py-7 sm:py-10 md:py-16 ${
            design.coverLayout === "editorial"
              ? "items-end lg:grid-cols-[1.25fr_0.75fr]"
              : "place-items-center text-center"
          }`}
        >
          <div className="max-w-5xl">
            <p
              className={`text-xs uppercase tracking-[0.28em] ${design.accent}`}
            >
              {resolvedPackage}
            </p>
            <h1 className="mt-5 font-serif text-[clamp(3.5rem,min(13vw,17vh),10.5rem)] leading-[0.76] tracking-[-0.065em] sm:mt-7">
              <span className="block">{couple.partnerOne}</span>
              <span className={`block italic ${design.accent}`}>&amp;</span>
              <span className="block">{couple.partnerTwo}</span>
            </h1>
            <p
              className={`mt-9 max-w-lg text-sm leading-7 ${design.muted} ${
                design.coverLayout === "editorial" ? "" : "mx-auto"
              } ${
                premium.textContrast
                  ? "font-medium !text-current drop-shadow-[0_1px_5px_rgba(255,255,255,.75)]"
                  : ""
              }`}
            >
              {opening.message}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <button
            className={`min-h-13 border px-8 text-[0.65rem] font-semibold uppercase tracking-[0.22em] transition hover:-translate-y-0.5 ${design.border} ${design.glow}`}
            onClick={onOpen}
            type="button"
          >
            {id ? "Buka Undangan" : "Open Invitation"}
          </button>
          <p
            className={`flex items-center gap-2 text-[0.55rem] uppercase tracking-[0.16em] ${
              premium.textContrast
                ? "font-semibold !text-current opacity-95 drop-shadow-[0_1px_6px_rgba(255,255,255,.95)]"
                : "opacity-55"
            }`}
          >
            {audioAvailable ? <Music2 size={12} /> : null}
            {audioAvailable
              ? id
                ? "Musik dimulai setelah undangan dibuka"
                : "Music begins after opening"
              : id
                ? "Preview audio segera tersedia"
                : "Preview audio coming soon"}
          </p>
        </div>
      </div>
    </motion.section>
  );
}

function FloatingAudio({
  playing,
  onToggle,
  title,
}: {
  playing: boolean;
  onToggle: () => void;
  title: string;
}) {
  return (
    <button
      aria-label={playing ? `Pause ${title}` : `Play ${title}`}
      className="fixed bottom-5 right-5 z-40 grid size-12 place-items-center rounded-full border border-white/25 bg-black/75 text-white shadow-2xl backdrop-blur"
      onClick={onToggle}
      type="button"
    >
      {playing ? <Pause size={17} /> : <Play size={17} />}
    </button>
  );
}

function EventStory({
  invitation,
  packageCode,
  design,
  premium,
}: {
  invitation: InvitationEnvelope;
  packageCode: PackageCode;
  design: ThemeVisual;
  premium: PremiumVisualConfig;
}) {
  const { event, story, quote, gallery } = invitation.content;
  const id = invitation.locale === "id";
  const capability = packageCapabilities[packageCode];
  const revealDistance = capability.motion === "refined" ? 46 : 28;

  return (
    <>
      <motion.section
        className={`${design.surface} relative overflow-hidden px-6 py-24 md:px-12 md:py-36`}
        initial={{ opacity: 0, y: revealDistance }}
        transition={{ duration: 0.85 }}
        viewport={{ once: true, amount: 0.18 }}
        whileInView={{ opacity: 1, y: 0 }}
      >
        <ThemeSectionDecoration
          config={premium}
          showOverlay={packageCode === "couture"}
        />
        <div className="relative z-30 mx-auto max-w-6xl">
          <p className="text-center text-[0.6rem] uppercase tracking-[0.25em] opacity-55">
            {id ? "Waktu & Tempat" : "Time & Place"}
          </p>
          <h2 className="mx-auto mt-7 max-w-4xl text-center font-serif text-[clamp(3rem,8vw,7rem)] leading-[0.86] tracking-[-0.05em]">
            {event.dateLabel}
          </h2>
          <div className="mt-16 grid gap-px bg-current/15 md:grid-cols-3">
            {[
              {
                label: event.ceremonyLabel,
                value: event.ceremonyTime,
                Icon: CalendarDays,
              },
              {
                label: event.receptionLabel,
                value: event.receptionTime,
                Icon: CalendarDays,
              },
              { label: event.venue, value: event.address, Icon: MapPin },
            ].map(({ label, value, Icon }) => (
              <div className={`${design.surface} p-7`} key={label}>
                <Icon size={19} />
                <p className="mt-9 text-[0.6rem] uppercase tracking-[0.18em] opacity-55">
                  {label}
                </p>
                <p className="mt-3 font-serif text-2xl leading-8">{value}</p>
              </div>
            ))}
          </div>
          <a
            className={`mx-auto mt-9 flex w-fit items-center gap-2 border-b pb-1 text-[0.62rem] uppercase tracking-[0.18em] ${design.border}`}
            href={event.mapUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <MapPin size={14} />
            {id ? "Buka peta" : "Open map"}
          </a>
        </div>
      </motion.section>

      <section className="relative overflow-hidden px-6 py-24 md:px-12 md:py-36">
        <ThemeSectionDecoration
          config={premium}
          showOverlay={packageCode === "couture"}
        />
        <div className="relative z-30 mx-auto grid max-w-6xl gap-14 lg:grid-cols-[0.85fr_1.15fr]">
          <motion.div
            initial={{ opacity: 0, x: -revealDistance }}
            viewport={{ once: true, amount: 0.3 }}
            whileInView={{ opacity: 1, x: 0 }}
          >
            <p className={`text-5xl ${design.accent}`} aria-hidden>
              {invitation.content.couple.monogram}
            </p>
            <h2 className="mt-8 font-serif text-[clamp(3rem,7vw,6rem)] leading-[0.88] tracking-[-0.045em]">
              {story.heading}
            </h2>
          </motion.div>
          <motion.div
            className="lg:pt-20"
            initial={{ opacity: 0, y: revealDistance }}
            viewport={{ once: true, amount: 0.3 }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <p className={`text-lg leading-9 ${design.muted}`}>{story.body}</p>
            <blockquote className={`mt-14 border-l pl-7 ${design.border}`}>
              <p className="font-serif text-2xl italic leading-9">
                “{quote.text}”
              </p>
              <footer className="mt-5 text-[0.6rem] uppercase tracking-[0.2em] opacity-55">
                {quote.attribution}
              </footer>
            </blockquote>
          </motion.div>
        </div>
      </section>

      <section className="relative overflow-hidden px-2">
        <ThemeSectionDecoration
          config={premium}
          showOverlay={packageCode === "couture"}
        />
        <div className="relative z-10 grid gap-2 md:grid-cols-12">
          {gallery.map((image, index) => (
            <motion.div
              className={`relative min-h-[52svh] overflow-hidden ${
                index === 0 ? "md:col-span-7" : "md:col-span-5"
              } ${index === 2 ? "md:col-span-12 md:min-h-[72svh]" : ""}`}
              initial={{ opacity: 0, scale: 1.025 }}
              key={`${image.src}-${index}`}
              viewport={{ once: true, amount: 0.18 }}
              whileInView={{ opacity: 1, scale: 1 }}
            >
              <Image
                alt={image.alt}
                className={`object-cover ${
                  capability.parallax === "premium"
                    ? "transition duration-[1600ms] hover:scale-[1.025]"
                    : ""
                }`}
                fill
                sizes={index === 2 ? "100vw" : "(max-width: 767px) 100vw, 58vw"}
                src={image.src}
              />
            </motion.div>
          ))}
        </div>
      </section>
    </>
  );
}

export function RendererV2({
  invitation,
  packageCode = "essential",
  audio,
  weather,
}: RendererV2Props) {
  const design = themeVisualConfig[invitation.rendererKey];
  const premium = getPremiumVisualConfig(invitation.rendererKey, packageCode);
  const reducedMotion = useReducedMotion();
  const [opened, setOpened] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { closing, couple } = invitation.content;

  useEffect(() => {
    const element = audioRef.current;
    if (!element || !audio) {
      return;
    }
    element.src = audio.secure_url;
    element.loop = audio.loop;
    element.volume = audio.default_volume;
    return () => {
      element.pause();
      element.removeAttribute("src");
      element.load();
    };
  }, [audio]);

  useEffect(() => {
    const pauseAudio = () => {
      const element = audioRef.current;
      if (!element) {
        return;
      }
      element.pause();
      setPlaying(false);
    };
    const pauseWhenHidden = () => {
      if (document.visibilityState === "hidden") {
        pauseAudio();
      }
    };

    document.addEventListener("visibilitychange", pauseWhenHidden);
    window.addEventListener("pagehide", pauseAudio);
    return () => {
      document.removeEventListener("visibilitychange", pauseWhenHidden);
      window.removeEventListener("pagehide", pauseAudio);
      pauseAudio();
    };
  }, []);

  async function playAudio() {
    if (!audioRef.current || !audio) {
      return;
    }
    try {
      await audioRef.current.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }

  function openInvitation() {
    setOpened(true);
    void playAudio();
  }

  function toggleAudio() {
    if (!audioRef.current) {
      return;
    }
    if (audioRef.current.paused) {
      void playAudio();
    } else {
      audioRef.current.pause();
      setPlaying(false);
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <article
        className={`${design.page} min-h-screen`}
        data-invitation-motion
        data-package={packageCode}
        data-theme={invitation.rendererKey}
      >
        <AnimatePresence>
          {!opened ? (
            <Cover
              audio={audio}
              audioAvailable={Boolean(audio)}
              design={design}
              invitation={invitation}
              key={`${invitation.rendererKey}-${packageCode}`}
              onOpen={openInvitation}
              packageCode={packageCode}
              premium={premium}
              weather={weather}
            />
          ) : null}
        </AnimatePresence>

        <div
          aria-hidden={!opened}
          className={`relative ${opened ? "" : "h-svh overflow-hidden"}`}
          inert={!opened}
        >
          <div>
            <EventStory
              design={design}
              invitation={invitation}
              packageCode={packageCode}
              premium={premium}
            />
            <div className="relative overflow-hidden">
              <ThemeSectionDecoration
                config={premium}
                showOverlay={packageCode === "couture"}
              />
              <div className="relative z-30">
                <ThemedWeather
                  design={design}
                  invitation={invitation}
                  packageCode={packageCode}
                  weather={weather}
                />
              </div>
            </div>
            <motion.section
              className={`${design.surface} relative grid min-h-[78svh] place-items-center overflow-hidden px-6 py-24 text-center`}
              initial={reducedMotion ? false : { opacity: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              whileInView={{ opacity: 1 }}
            >
              <ThemeSectionDecoration
                config={premium}
                showOverlay={packageCode === "couture"}
              />
              <div className="relative z-30 max-w-4xl">
                <Volume2 className={`mx-auto ${design.accent}`} size={26} />
                <h2 className="mt-10 font-serif text-[clamp(4rem,10vw,9rem)] leading-[0.82] tracking-[-0.055em]">
                  {closing.heading}
                </h2>
                <p className="mx-auto mt-9 max-w-lg text-sm leading-7 opacity-70">
                  {closing.message}
                </p>
                <p className="mt-14 font-serif text-2xl italic">
                  {couple.partnerOne} &amp; {couple.partnerTwo}
                </p>
              </div>
            </motion.section>
          </div>
        </div>

        <audio ref={audioRef} />
        {opened && audio ? (
          <FloatingAudio
            onToggle={toggleAudio}
            playing={playing}
            title={audio.title}
          />
        ) : null}
      </article>
    </MotionConfig>
  );
}
