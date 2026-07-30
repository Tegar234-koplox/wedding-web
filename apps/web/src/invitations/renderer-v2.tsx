"use client";

import {
  packageCapabilities,
  type InvitationEnvelope,
  type PackageCode,
  type RendererKey,
} from "@wedding/invitation-themes";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Music2,
  Pause,
  Play,
  Send,
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
import { InvitationCard, InvitationFrame } from "@/invitations/invitation-card";
import { mediaSectionStartFor } from "@/invitations/media-plan";
import {
  CoverTextContrastLayer,
  ThemeCoverDecoration,
  ThemeSectionDecoration,
} from "@/invitations/theme-ornament";
import { ThemedWeather } from "@/invitations/themed-weather";
import type {
  InvitationAudio,
  InvitationCover,
  InvitationWeather,
} from "@/lib/api/contracts";

import ambientStyles from "./invitation-ambient.module.css";
import couplePortraitStyles from "./couple-portrait.module.css";
import coutureStyles from "./couture-motion.module.css";

export type RendererV2Props = {
  invitation: InvitationEnvelope;
  packageCode?: PackageCode;
  audio?: InvitationAudio | null;
  cover?: InvitationCover;
  rsvpSlot?: React.ReactNode;
  weather?: InvitationWeather | null;
};

type BankAccount = {
  account_number?: string;
  bank?: string;
  name?: string;
  number?: string;
};

type TimelineEntry = readonly [string, string, string];
type TimelineEntries = readonly TimelineEntry[];
type TimelineMode =
  | "opening"
  | "middle"
  | "final"
  | "conflict"
  | "intimacy"
  | "trust";

const textFadeTransition = {
  duration: 0.85,
  ease: [0.22, 1, 0.36, 1],
} as const;

const brightPhotoBackgroundThemes = new Set<RendererKey>([
  "elegant-classic",
  "islamic-soft",
  "minimalist-white",
  "floral-romantic",
]);

function timelineOverride(
  invitation: InvitationEnvelope,
  mode: TimelineMode,
): TimelineEntries | null {
  const timeline = invitation.content.timeline;
  const entries = timeline?.[mode];
  if (!entries?.length) {
    return null;
  }
  const normalized = entries
    .map(
      (entry) =>
        [
          entry.number.trim(),
          entry.title.trim(),
          entry.description.trim(),
        ] as const,
    )
    .filter(([number, title, description]) => number && title && description);
  return normalized.length ? normalized : null;
}

const essentialCouplePhotos = [
  {
    alt: "Essential groom portrait",
    src: "/images/invitation-essential/section-2/groom.webp",
  },
  {
    alt: "Essential bride portrait",
    src: "/images/invitation-essential/section-2/bride.webp",
  },
] as const;

const essentialSectionFourPhotos = [
  {
    alt: "Essential wedding portrait top composition",
    src: "/images/invitation-essential/section-4/section-4-01.webp",
  },
  {
    alt: "Essential wedding portrait middle composition",
    src: "/images/invitation-essential/section-4/section-4-02.webp",
  },
  {
    alt: "Essential wedding portrait bottom composition",
    src: "/images/invitation-essential/section-4/section-4-03.webp",
  },
] as const;

const essentialSectionSixPhotos = Array.from({ length: 9 }, (_, index) => ({
  alt: `Essential gallery portrait ${index + 1}`,
  src: `/images/invitation-essential/section-6/gallery-${String(
    index + 1,
  ).padStart(2, "0")}.webp`,
}));

const signatureCouplePhotos = [
  {
    alt: "Signature groom portrait",
    src: "/images/invitation-signature/section-2/groom.webp",
  },
  {
    alt: "Signature bride portrait",
    src: "/images/invitation-signature/section-2/bride.webp",
  },
] as const;

const signatureSectionFourPhotos = Array.from({ length: 3 }, (_, index) => ({
  alt: `Signature story portrait ${index + 1}`,
  src: `/images/invitation-signature/section-4/photo-${String(
    index + 1,
  ).padStart(2, "0")}.webp`,
}));

const signatureSectionSixPhotos = [
  {
    alt: "Signature full gallery portrait",
    src: "/images/invitation-signature/section-6/cover.webp",
  },
  ...Array.from({ length: 4 }, (_, index) => ({
    alt: `Signature quadrant portrait ${index + 1}`,
    src: `/images/invitation-signature/section-6/quadrant-${String(
      index + 1,
    ).padStart(2, "0")}.webp`,
  })),
];

const signatureSectionEightPhotos = Array.from({ length: 9 }, (_, index) => ({
  alt: `Signature gallery portrait ${index + 1}`,
  src: `/images/invitation-signature/section-8/photo-${String(
    index + 1,
  ).padStart(2, "0")}.webp`,
}));

const signatureSectionTenPhotos = Array.from({ length: 9 }, (_, index) => ({
  alt: `Signature carousel portrait ${index + 1}`,
  src: `/images/invitation-signature/section-10/photo-${String(
    index + 1,
  ).padStart(2, "0")}.webp`,
}));

const signatureToggleIcons: Record<
  RendererKey,
  { after: string; before: string }
> = Object.fromEntries(
  [
    "dark-cinematic",
    "elegant-classic",
    "floral-romantic",
    "islamic-soft",
    "javanese-traditional",
    "luxury-gold",
    "minimalist-white",
  ].map((key) => [
    key,
    {
      after: `/images/invitation-signature/section-2/icons/${key}-after.svg`,
      before: `/images/invitation-signature/section-2/icons/${key}-before.svg`,
    },
  ]),
) as Record<RendererKey, { after: string; before: string }>;

const coutureAssetRoot = "/images/invitation-couture/v2";

const coutureCouplePhotos = [
  {
    alt: "Couture groom portrait",
    src: `${coutureAssetRoot}/section-2/groom.webp`,
  },
  {
    alt: "Couture bride portrait",
    src: `${coutureAssetRoot}/section-2/bride.webp`,
  },
] as const;

const coutureSectionFourPhotos = Array.from({ length: 3 }, (_, index) => ({
  alt: `Couture story portrait ${index + 1}`,
  src: `${coutureAssetRoot}/section-4/photo-${String(index + 1).padStart(2, "0")}.webp`,
}));

const coutureSectionFiveBackground = [
  {
    alt: "Couture story background",
    src: `${coutureAssetRoot}/section-5/background.webp`,
  },
] as const;

const coutureSectionSixPhotos = [
  {
    alt: "Couture full gallery portrait",
    src: `${coutureAssetRoot}/section-6/cover.webp`,
  },
  ...Array.from({ length: 4 }, (_, index) => ({
    alt: `Couture quadrant portrait ${index + 1}`,
    src: `${coutureAssetRoot}/section-6/quadrant-${String(index + 1).padStart(2, "0")}.webp`,
  })),
];

const coutureSectionEightPhotos = Array.from({ length: 9 }, (_, index) => ({
  alt: `Couture gallery portrait ${index + 1}`,
  src: `${coutureAssetRoot}/section-8/photo-${String(index + 1).padStart(2, "0")}.webp`,
}));

const coutureSectionNineBackgrounds = Array.from({ length: 3 }, (_, index) => ({
  alt: `Couture story background ${index + 1}`,
  src: `${coutureAssetRoot}/section-9/background-${String(index + 1).padStart(2, "0")}.webp`,
}));

const coutureSectionTenPhotos = [
  {
    alt: "Couture carousel background",
    src: `${coutureAssetRoot}/section-10/background.webp`,
  },
  ...Array.from({ length: 9 }, (_, index) => ({
    alt: `Couture carousel portrait ${index + 1}`,
    src: `${coutureAssetRoot}/section-10/photo-${String(index + 1).padStart(2, "0")}.webp`,
  })),
];

const coutureSectionTwelvePhotos = Array.from({ length: 3 }, (_, index) => ({
  alt: `Couture closing portrait ${index + 1}`,
  src: `${coutureAssetRoot}/section-12/photo-${String(index + 1).padStart(2, "0")}.webp`,
}));

const coutureToggleAssets: Record<
  RendererKey,
  { after: string; before: string; closeSound: string; openSound: string }
> = Object.fromEntries(
  [
    "dark-cinematic",
    "elegant-classic",
    "floral-romantic",
    "islamic-soft",
    "javanese-traditional",
    "luxury-gold",
    "minimalist-white",
  ].map((key) => [
    key,
    {
      after: `${coutureAssetRoot}/toggles/${key}/after.webp`,
      before: `${coutureAssetRoot}/toggles/${key}/before.webp`,
      closeSound: `/audio/invitation-couture/toggles/${key}/close.mp3`,
      openSound: `/audio/invitation-couture/toggles/${key}/open.mp3`,
    },
  ]),
) as Record<
  RendererKey,
  { after: string; before: string; closeSound: string; openSound: string }
>;

type GalleryPhoto = NonNullable<
  InvitationEnvelope["content"]["gallery"][number]
>;

export function sectionPhotosFromGallery(
  gallery: InvitationEnvelope["content"]["gallery"],
  start: number,
  count: number,
  fallback: readonly GalleryPhoto[],
): GalleryPhoto[] {
  return Array.from({ length: count }, (_, index) => {
    const photo = gallery[start + index];
    return photo ?? fallback[index] ?? gallery[index] ?? fallback[0];
  }).filter((photo): photo is GalleryPhoto => Boolean(photo));
}

const signatureGiftFolders: Record<RendererKey, string> = {
  "dark-cinematic": "dark-cinematic",
  "elegant-classic": "elegant-classic",
  "floral-romantic": "floral-romantic",
  "islamic-soft": "islamic-soft",
  "javanese-traditional": "javanese-traditional",
  "luxury-gold": "luxury-gold",
  "minimalist-white": "minimalist-white",
};

const coutureGiftSoundEffects: Record<RendererKey, string> = {
  "dark-cinematic":
    "https://res.cloudinary.com/djhewrs1n/video/upload/v1783150346/chest_treasure_tntcss.mp3",
  "elegant-classic":
    "https://res.cloudinary.com/djhewrs1n/video/upload/v1783150404/book_open_wthcdp.mp3",
  "floral-romantic":
    "https://res.cloudinary.com/djhewrs1n/video/upload/v1783150533/bloom_flower_sgun0y.mp3",
  "islamic-soft":
    "https://res.cloudinary.com/djhewrs1n/video/upload/v1783150566/shine_v0l8dd.mp3",
  "javanese-traditional":
    "https://res.cloudinary.com/djhewrs1n/video/upload/v1783150592/magical_sword_grzuis.mp3",
  "luxury-gold":
    "https://res.cloudinary.com/djhewrs1n/video/upload/v1783150619/sparkle_utsi71.mp3",
  "minimalist-white":
    "https://res.cloudinary.com/djhewrs1n/video/upload/v1783150677/grow_tree_qm57u4.mp3",
};

function FadeText({
  children,
  className = "",
  delay = 0,
  distance = 18,
  once = true,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
  once?: boolean;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: distance }}
      transition={{ ...textFadeTransition, delay }}
      viewport={{ once, amount: 0.28 }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      {children}
    </motion.div>
  );
}

function coupleCaptionTextClass(design: ThemeVisual) {
  return design.key === "floral-romantic"
    ? "relative !text-[#271216] [text-shadow:0_1px_3px_rgba(255,255,255,0.95),0_0_12px_rgba(255,255,255,0.8)]"
    : `relative ${design.ink} [text-shadow:0_1px_2px_rgba(255,255,255,0.55),0_2px_7px_rgba(0,0,0,0.8)]`;
}

function Cover({
  invitation,
  packageCode,
  cover,
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
  const guestName = invitation.guest?.displayName?.trim();
  const resolvedPackage = packageCode ?? "essential";
  const capability = packageCapabilities[resolvedPackage];
  const couture = resolvedPackage === "couture";
  const id = invitation.locale === "id";
  const essential = resolvedPackage === "essential";
  const coverImage = cover?.secure_url ?? design.coverImage;
  const coverPosition = cover
    ? `${cover.focal_x}% ${cover.focal_y}%`
    : "50% 50%";
  const supportTextClass =
    "font-medium !text-current opacity-95 drop-shadow-[0_1px_5px_rgba(0,0,0,.45)]";

  return (
    <motion.section
      className={`fixed inset-0 z-50 grid min-h-svh overflow-hidden ${design.page}`}
      exit={{ opacity: 0, scale: 1.025 }}
      transition={{ duration: couture ? 1.15 : 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      <Image
        alt={`Wedding cover for ${couple.partnerOne} and ${couple.partnerTwo}`}
        className="object-cover"
        data-cover-source={cover ? "custom" : "theme"}
        fill
        priority
        sizes="100vw"
        src={coverImage}
        style={{ objectPosition: coverPosition }}
        unoptimized={Boolean(cover)}
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
      <InvitationFrame
        className="pointer-events-none absolute inset-5 z-[5] md:inset-9"
        design={design}
        packageCode={resolvedPackage}
      />

      <div className="relative z-10 grid min-h-svh grid-rows-[auto_1fr_auto] px-7 pb-24 pt-7 sm:pb-28 md:px-14 md:py-12">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between text-[0.58rem] uppercase tracking-[0.24em]"
          initial={{ opacity: 0, y: 12 }}
          transition={{ ...textFadeTransition, delay: 0.1 }}
        >
          <span>{opening.eyebrow}</span>
          <span>{event.dateLabel}</span>
        </motion.div>

        <div
          className={`grid content-center py-7 sm:py-10 md:py-16 ${
            design.coverLayout === "editorial"
              ? "items-end lg:grid-cols-[1.25fr_0.75fr]"
              : "place-items-center text-center"
          }`}
        >
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="max-w-5xl"
            initial={{ opacity: 0, y: 22 }}
            transition={{ ...textFadeTransition, delay: 0.22 }}
          >
            <p
              className={`text-xs uppercase tracking-[0.28em] ${design.accent}`}
            >
              {resolvedPackage}
            </p>
            {guestName ? (
              <p
                className={`mt-5 text-[0.62rem] font-semibold uppercase tracking-[0.24em] ${
                  essential ? supportTextClass : design.muted
                } ${
                  !essential && premium.textContrast
                    ? "font-semibold !text-current drop-shadow-[0_1px_5px_rgba(255,255,255,.75)]"
                    : ""
                }`}
              >
                {id ? `Untuk ${guestName}` : `For ${guestName}`}
              </p>
            ) : null}
            <h1 className="mt-5 font-serif text-[clamp(3.5rem,min(13vw,17vh),10.5rem)] leading-[0.76] tracking-[-0.065em] sm:mt-7">
              <span className="block">{couple.partnerOne}</span>
              <span className={`block italic ${design.accent}`}>&amp;</span>
              <span className="block">{couple.partnerTwo}</span>
            </h1>
            <p
              className={`mt-9 max-w-lg text-sm leading-7 ${
                essential ? supportTextClass : design.muted
              } ${design.coverLayout === "editorial" ? "" : "mx-auto"} ${
                !essential && premium.textContrast
                  ? "font-medium !text-current drop-shadow-[0_1px_5px_rgba(255,255,255,.75)]"
                  : ""
              }`}
            >
              {opening.message}
            </p>
          </motion.div>
        </div>

        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, y: 16 }}
          transition={{ ...textFadeTransition, delay: 0.42 }}
        >
          <button
            className={`min-h-13 border px-8 text-[0.65rem] font-semibold uppercase tracking-[0.22em] transition hover:-translate-y-0.5 ${design.border} ${design.glow}`}
            onClick={onOpen}
            type="button"
          >
            {id ? "Buka Undangan" : "Open Invitation"}
          </button>
          <p
            className={`flex items-center gap-2 text-[0.55rem] uppercase tracking-[0.16em] ${
              essential
                ? `font-semibold ${supportTextClass}`
                : premium.textContrast
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
        </motion.div>
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

function getGiftAccount(invitation: InvitationEnvelope, id: boolean) {
  const content = invitation.content as InvitationEnvelope["content"] & {
    bank_accounts?: BankAccount[];
  };
  const account = content.bank_accounts?.find(
    (item) => item.bank || item.number || item.account_number,
  );

  if (!account) {
    return {
      label: id ? "BCA 615xxxxx" : "BCA 615xxxxx",
      name: id ? "Nama pengantin" : "Couple account",
    };
  }

  const number = account.number ?? account.account_number ?? "";
  return {
    label: [account.bank, number].filter(Boolean).join(" "),
    name: account.name ?? "",
  };
}

function GiftIconButton({
  afterAlt,
  afterSrc,
  beforeAlt,
  beforeSrc,
  borderClass,
  glowClass,
  opened,
  onOpen,
}: {
  afterAlt: string;
  afterSrc: string;
  beforeAlt: string;
  beforeSrc: string;
  borderClass: string;
  glowClass: string;
  opened: boolean;
  onOpen: () => void;
}) {
  const icons = [
    { active: !opened, alt: beforeAlt, key: "before", src: beforeSrc },
    { active: opened, alt: afterAlt, key: "after", src: afterSrc },
  ];

  return (
    <button
      aria-expanded={opened}
      className={`group relative grid size-32 place-items-center rounded-full border ${borderClass} ${glowClass} transition hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-current/35`}
      onClick={onOpen}
      type="button"
    >
      {icons.map((icon) => (
        <motion.span
          aria-hidden={!icon.active}
          animate={{
            borderRadius: "50%",
            filter: icon.active ? "blur(0px)" : "blur(8px)",
            opacity: icon.active ? 1 : 0,
            rotate: icon.active ? 0 : icon.key === "before" ? -10 : 10,
            scale: icon.active ? 1 : icon.key === "before" ? 1.08 : 0.82,
          }}
          className="absolute inset-0 block"
          initial={false}
          key={icon.key}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        >
          <Image
            alt={icon.alt}
            className="object-contain p-3 transition duration-500 group-hover:scale-105"
            fill
            sizes="8rem"
            src={icon.src}
          />
        </motion.span>
      ))}
    </button>
  );
}

function EssentialPhotoSection({
  design,
  photos,
  title,
  variant,
}: {
  design: ThemeVisual;
  photos: readonly { alt: string; src: string }[];
  title: string;
  variant: "three" | "two";
}) {
  return (
    <section
      className="relative overflow-hidden px-2 py-2"
      data-essential-section="4"
    >
      <div className="sr-only">{title}</div>
      <div
        className={`grid gap-2 ${
          variant === "three" ? "md:grid-cols-3" : "md:grid-cols-2"
        }`}
      >
        {photos.map((image, index) => (
          <motion.div
            initial={{ opacity: 0, scale: 1.015 }}
            key={image.src}
            viewport={{ once: true, amount: 0.18 }}
            whileInView={{ opacity: 1, scale: 1 }}
          >
            <InvitationCard
              className="h-full"
              contentClassName={`relative min-h-[56svh] ${
                variant === "three" && index === 1 ? "md:min-h-[68svh]" : ""
              }`}
              design={design}
              packageCode="essential"
              photo
            >
              <Image
                alt={image.alt}
                className="object-cover"
                fill
                sizes={
                  variant === "three"
                    ? "(max-width: 767px) 100vw, 33vw"
                    : "(max-width: 767px) 100vw, 50vw"
                }
                src={image.src}
              />
            </InvitationCard>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

type CouplePortraitPerson = {
  description: string;
  name: string;
  photo: GalleryPhoto;
  role: "bride" | "groom";
};

function CouplePortraitPanels({
  design,
  opened,
  packageCode,
  panelId,
  people,
  toggle,
}: {
  design: ThemeVisual;
  opened: boolean;
  packageCode: PackageCode;
  panelId: string;
  people: readonly CouplePortraitPerson[];
  toggle: React.ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  const premiumPhoto = packageCode !== "essential";

  return (
    <div
      className="relative grid min-h-[max(100svh,54rem)] grid-rows-2 lg:min-h-[100svh] lg:grid-cols-2 lg:grid-rows-1"
      data-section-two-desktop-layout="split"
      data-section-two-layout="portrait-stack"
      id={panelId}
    >
      {people.map((person, index) => {
        const panelAttributes =
          packageCode === "essential"
            ? { "data-couple-panel": person.role }
            : packageCode === "signature"
              ? { "data-signature-couple-panel": person.role }
              : { "data-couture-couple-panel": person.role };
        const photoAttributes =
          packageCode === "essential"
            ? { "data-couple-photo": person.role }
            : packageCode === "signature"
              ? { "data-signature-couple-photo": person.role }
              : { "data-couture-couple-photo": person.role };
        const captionAttributes =
          packageCode === "essential"
            ? { "data-couple-caption": person.role }
            : packageCode === "signature"
              ? { "data-signature-couple-caption": person.role }
              : { "data-couture-couple-caption": person.role };

        const portrait = (
          <Image
            alt={person.photo.alt}
            className="object-cover object-[center_28%]"
            fill
            loading="eager"
            sizes="(max-width: 1023px) 28vw, 27vw"
            src={person.photo.src}
          />
        );

        return (
          <div
            className={`relative flex min-h-[27rem] items-center justify-center overflow-hidden px-6 sm:px-10 lg:min-h-[100svh] lg:px-12 lg:py-10 ${
              index === 0 ? "pb-16 pt-8" : "pb-24 pt-16"
            }`}
            key={person.role}
            {...panelAttributes}
          >
            <motion.div
              animate={{
                opacity: opened ? 1 : 0,
                scale: opened ? 1 : 0.96,
                y: opened ? 0 : index === 0 ? 72 : -72,
              }}
              aria-hidden={!opened}
              className="relative z-30 flex w-full flex-col items-center"
              initial={false}
              transition={{
                duration: reducedMotion ? 0 : 0.72,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <div
                className={`${couplePortraitStyles.portraitFrame} relative`}
                data-section-two-photo-frame={
                  premiumPhoto ? packageCode : "none"
                }
                {...photoAttributes}
              >
                {premiumPhoto ? (
                  <InvitationCard
                    className="w-full"
                    contentClassName="relative aspect-[4/5]"
                    context={`section-2-${person.role}`}
                    design={design}
                    packageCode={packageCode}
                    photo
                    surfaceClassName="bg-transparent"
                  >
                    {portrait}
                  </InvitationCard>
                ) : (
                  <div className="relative aspect-[4/5] overflow-hidden">
                    {portrait}
                  </div>
                )}
              </div>

              <AnimatePresence>
                {opened ? (
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 max-w-xl text-center md:mt-5 lg:mt-7 lg:max-w-lg"
                    exit={{
                      opacity: 0,
                      transition: { duration: reducedMotion ? 0 : 0.16 },
                      y: reducedMotion ? 0 : 8,
                    }}
                    initial={reducedMotion ? false : { opacity: 0, y: 12 }}
                    transition={{
                      delay: reducedMotion ? 0 : 0.36,
                      duration: reducedMotion ? 0 : 0.38,
                    }}
                    {...captionAttributes}
                  >
                    <div
                      className={coupleCaptionTextClass(design)}
                      data-couple-caption-text={design.key}
                    >
                      <h2
                        className={`${couplePortraitStyles.nameFrame} ${couplePortraitStyles[packageCode]} font-serif text-2xl italic leading-tight tracking-[0.03em] md:text-3xl lg:text-4xl`}
                        data-section-two-name-frame={packageCode}
                        style={
                          {
                            "--name-border": design.cardBorderColor,
                            "--name-glow": design.cardGlowColor,
                            "--name-shine": design.cardShineColor,
                          } as React.CSSProperties
                        }
                      >
                        {person.name}
                      </h2>
                      <p className="mt-1.5 font-sans text-sm font-medium leading-relaxed tracking-[0.02em] lg:mt-3 lg:text-base">
                        {person.description}
                      </p>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          </div>
        );
      })}

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 z-40 h-px lg:inset-y-0 lg:bottom-0 lg:left-1/2 lg:right-auto lg:top-0 lg:h-auto lg:w-px"
        data-section-two-divider
        {...(packageCode === "signature"
          ? { "data-signature-divider": "" }
          : {})}
        style={{
          backgroundColor: design.cardBorderColor,
          boxShadow: premiumPhoto
            ? `0 0 18px ${design.cardGlowColor}, 0 0 5px ${design.cardShineColor}`
            : "none",
        }}
      />

      <div className="absolute left-1/2 top-1/2 z-[70] -translate-x-1/2 -translate-y-1/2">
        {toggle}
      </div>
    </div>
  );
}

function EssentialCoupleRevealSection({
  design,
  invitation,
}: {
  design: ThemeVisual;
  invitation: InvitationEnvelope;
}) {
  const [opened, setOpened] = useState(false);
  const reducedMotion = useReducedMotion();
  const id = invitation.locale === "id";
  const { couple, gallery } = invitation.content;
  const photos = sectionPhotosFromGallery(
    gallery,
    mediaSectionStartFor("essential", 2),
    2,
    essentialCouplePhotos,
  );
  const people = [
    {
      description:
        couple.partnerTwoDescription ?? (id ? "Mempelai pria" : "Groom"),
      name: couple.partnerTwo,
      photo: photos[0] ?? essentialCouplePhotos[0],
      role: "groom",
    },
    {
      description:
        couple.partnerOneDescription ?? (id ? "Mempelai wanita" : "Bride"),
      name: couple.partnerOne,
      photo: photos[1] ?? essentialCouplePhotos[1],
      role: "bride",
    },
  ] as const;
  const buttonLabel = opened
    ? id
      ? "Tutup foto kedua mempelai"
      : "Hide couple photos"
    : id
      ? "Buka foto kedua mempelai"
      : "Reveal couple photos";
  const heartBase =
    "/images/invitation-essential/section-2/hearts/" + invitation.rendererKey;

  return (
    <section
      className={`${design.page} relative overflow-hidden`}
      data-essential-section="2"
    >
      <CouplePortraitPanels
        design={design}
        opened={opened}
        packageCode="essential"
        panelId="essential-couple-reveal-panels"
        people={people}
        toggle={
          <button
            aria-controls="essential-couple-reveal-panels"
            aria-expanded={opened}
            aria-label={buttonLabel}
            className={`${design.surface} ${design.border} ${design.glow} relative grid size-20 place-items-center rounded-full border transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-current/40`}
            data-heart-state={opened ? "whole" : "broken"}
            onClick={() => setOpened((current) => !current)}
            type="button"
          >
            {[
              {
                active: !opened,
                key: "broken",
                src: `${heartBase}-broken.svg`,
              },
              {
                active: opened,
                key: "whole",
                src: `${heartBase}-whole.svg`,
              },
            ].map((icon) => (
              <motion.span
                animate={{
                  opacity: icon.active ? 1 : 0,
                  scale: icon.active ? 1 : 0.92,
                }}
                aria-hidden
                className="absolute inset-4"
                initial={false}
                key={icon.key}
                transition={{ duration: reducedMotion ? 0 : 0.3 }}
              >
                <Image
                  alt=""
                  className="object-contain"
                  fill
                  sizes="3rem"
                  src={icon.src}
                  unoptimized
                />
              </motion.span>
            ))}
          </button>
        }
      />
    </section>
  );
}

function SignatureToggleButton({
  design,
  invitation,
  label,
  onToggle,
  opened,
}: {
  design: ThemeVisual;
  invitation: InvitationEnvelope;
  label: string;
  onToggle: () => void;
  opened: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const icons =
    signatureToggleIcons[invitation.rendererKey as RendererKey] ??
    signatureToggleIcons["elegant-classic"];

  return (
    <button
      aria-expanded={opened}
      aria-label={label}
      className={`${design.surface} ${design.glow} group relative grid size-20 place-items-center rounded-full border transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-current/45`}
      data-signature-toggle-state={opened ? "opened" : "closed"}
      onClick={onToggle}
      style={{
        borderColor: design.cardBorderColor,
        boxShadow: `0 0 0 1px ${design.cardBorderColor}, 0 0 28px ${design.cardGlowColor}`,
      }}
      type="button"
    >
      {[
        { active: !opened, key: "before", src: icons.before },
        { active: opened, key: "after", src: icons.after },
      ].map((icon) => (
        <motion.span
          animate={{
            filter: icon.active ? "blur(0px)" : "blur(5px)",
            opacity: icon.active ? 1 : 0,
            scale: icon.active ? 1 : 0.9,
          }}
          aria-hidden
          className="absolute inset-3"
          initial={false}
          key={icon.key}
          transition={{
            duration: reducedMotion ? 0 : 0.34,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <Image
            alt=""
            className="object-contain"
            fill
            sizes="3.5rem"
            src={icon.src}
            unoptimized
          />
        </motion.span>
      ))}
    </button>
  );
}

function SignatureCoupleRevealSection({
  design,
  invitation,
  premium,
}: {
  design: ThemeVisual;
  invitation: InvitationEnvelope;
  premium: PremiumVisualConfig;
}) {
  const [opened, setOpened] = useState(false);
  const id = invitation.locale === "id";
  const { couple, gallery } = invitation.content;
  const photos = sectionPhotosFromGallery(
    gallery,
    mediaSectionStartFor("signature", 2),
    2,
    signatureCouplePhotos,
  );
  const people = [
    {
      description:
        couple.partnerTwoDescription ?? (id ? "Mempelai pria" : "Groom"),
      name: couple.partnerTwo,
      photo: photos[0] ?? signatureCouplePhotos[0],
      role: "groom",
    },
    {
      description:
        couple.partnerOneDescription ?? (id ? "Mempelai wanita" : "Bride"),
      name: couple.partnerOne,
      photo: photos[1] ?? signatureCouplePhotos[1],
      role: "bride",
    },
  ] as const;
  const buttonLabel = opened
    ? id
      ? "Tutup foto Signature kedua mempelai"
      : "Hide Signature couple photos"
    : id
      ? "Buka foto Signature kedua mempelai"
      : "Reveal Signature couple photos";

  return (
    <section
      className={`${design.page} relative overflow-hidden`}
      data-signature-section="2"
    >
      <ThemeSectionDecoration front config={premium} showOverlay={false} />
      <CouplePortraitPanels
        design={design}
        opened={opened}
        packageCode="signature"
        panelId="signature-couple-reveal-panels"
        people={people}
        toggle={
          <SignatureToggleButton
            design={design}
            invitation={invitation}
            label={buttonLabel}
            onToggle={() => setOpened((current) => !current)}
            opened={opened}
          />
        }
      />
    </section>
  );
}

function SignatureThreePhotoSection({
  design,
  gallery,
  premium,
}: {
  design: ThemeVisual;
  gallery: InvitationEnvelope["content"]["gallery"];
  premium: PremiumVisualConfig;
}) {
  const photos = sectionPhotosFromGallery(
    gallery,
    mediaSectionStartFor("signature", 4),
    3,
    signatureSectionFourPhotos,
  );

  return (
    <section
      className={`${design.page} relative overflow-hidden px-2 py-2`}
      data-signature-section="4"
    >
      <ThemeSectionDecoration front config={premium} showOverlay={false} />
      <div className="relative z-30 grid gap-2 md:grid-cols-3">
        {photos.map((image, index) => (
          <motion.div
            data-signature-section-four-photo={index + 1}
            initial={{ opacity: 0, scale: 1.015 }}
            key={`${image.src}-${index}`}
            viewport={{ once: true, amount: 0.18 }}
            whileInView={{ opacity: 1, scale: 1 }}
          >
            <InvitationCard
              className="h-full"
              contentClassName={`relative min-h-[58svh] ${
                index === 1 ? "md:min-h-[70svh]" : ""
              }`}
              design={design}
              packageCode="signature"
              photo
            >
              <Image
                alt={image.alt}
                className="object-cover"
                fill
                sizes="(max-width: 767px) 100vw, 33vw"
                src={image.src}
              />
            </InvitationCard>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function SignatureQuadrantRevealSection({
  design,
  invitation,
  premium,
}: {
  design: ThemeVisual;
  invitation: InvitationEnvelope;
  premium: PremiumVisualConfig;
}) {
  const [opened, setOpened] = useState(false);
  const reducedMotion = useReducedMotion();
  const id = invitation.locale === "id";
  const photos = sectionPhotosFromGallery(
    invitation.content.gallery,
    mediaSectionStartFor("signature", 6),
    5,
    signatureSectionSixPhotos,
  );
  const coverPhoto = photos[0] ?? signatureSectionSixPhotos[0];
  const quadrantPhotos = Array.from(
    { length: 4 },
    (_, index) => photos[index + 1] ?? signatureSectionSixPhotos[index + 1],
  ).filter((photo): photo is GalleryPhoto => Boolean(photo));
  const hiddenPositions = [
    { x: "100%", y: "100%" },
    { x: "-100%", y: "100%" },
    { x: "100%", y: "-100%" },
    { x: "-100%", y: "-100%" },
  ] as const;
  const buttonLabel = opened
    ? id
      ? "Tutup galeri empat foto"
      : "Close four-photo gallery"
    : id
      ? "Buka galeri empat foto"
      : "Reveal four-photo gallery";

  return (
    <section
      className={`${design.page} relative min-h-[100svh] overflow-hidden p-2`}
      data-signature-section="6"
    >
      <ThemeSectionDecoration front config={premium} showOverlay={false} />
      <div className="relative z-30 min-h-[calc(100svh-1rem)] overflow-hidden">
        <div
          className="absolute inset-0 will-change-transform"
          data-signature-section-six-cover
        >
          <InvitationCard
            className="!absolute inset-0 h-full"
            contentClassName="relative h-full"
            design={design}
            packageCode="signature"
            photo
            surfaceClassName="bg-transparent"
          >
            <Image
              alt={coverPhoto?.alt ?? "Signature full gallery portrait"}
              className="object-cover object-[center_30%]"
              fill
              loading="eager"
              sizes="100vw"
              src={
                coverPhoto?.src ??
                "/images/invitation-signature/section-6/cover.webp"
              }
            />
            <div
              aria-hidden
              className={`${design.surface} absolute inset-0 opacity-50`}
              data-signature-section-six-overlay
            />
          </InvitationCard>
        </div>

        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
          {quadrantPhotos.map((image, index) => (
            <motion.div
              animate={{
                opacity: opened ? 1 : 0,
                x: opened ? "0%" : hiddenPositions[index]?.x,
                y: opened ? "0%" : hiddenPositions[index]?.y,
              }}
              aria-hidden={!opened}
              className="relative min-h-0 min-w-0 will-change-transform"
              data-signature-quadrant={index + 1}
              initial={false}
              key={`${image.src}-${index}`}
              transition={{
                delay: reducedMotion
                  ? 0
                  : opened
                    ? index * 0.16
                    : (3 - index) * 0.16,
                duration: reducedMotion ? 0 : 0.62,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <InvitationCard
                className="!absolute inset-0 h-full"
                contentClassName="relative h-full"
                design={design}
                packageCode="signature"
                photo
                surfaceClassName="bg-transparent"
              >
                <Image
                  alt={image.alt}
                  className="object-cover object-center"
                  fill
                  loading="eager"
                  sizes="50vw"
                  src={image.src}
                />
              </InvitationCard>
            </motion.div>
          ))}
        </div>

        <div className="absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2">
          <SignatureToggleButton
            design={design}
            invitation={invitation}
            label={buttonLabel}
            onToggle={() => setOpened((current) => !current)}
            opened={opened}
          />
        </div>
      </div>
    </section>
  );
}

function SignatureNinePhotoGallery({
  design,
  gallery,
  premium,
}: {
  design: ThemeVisual;
  gallery: InvitationEnvelope["content"]["gallery"];
  premium: PremiumVisualConfig;
}) {
  const reducedMotion = useReducedMotion();
  const photos = sectionPhotosFromGallery(
    gallery,
    mediaSectionStartFor("signature", 8),
    9,
    signatureSectionEightPhotos,
  );

  return (
    <section
      className={`${design.page} relative overflow-hidden px-2 py-16 md:px-4 md:py-24`}
      data-signature-section="8"
    >
      <ThemeSectionDecoration front config={premium} showOverlay={false} />
      <motion.div
        className="relative z-30 grid grid-cols-3 gap-2 md:gap-3"
        initial={reducedMotion ? false : "hidden"}
        variants={{
          hidden: {},
          visible: {
            transition: { staggerChildren: reducedMotion ? 0 : 0.07 },
          },
        }}
        viewport={{ once: true, amount: 0.2 }}
        whileInView="visible"
      >
        {photos.map((image, index) => (
          <motion.div
            data-signature-gallery-item
            key={`${image.src}-${index}`}
            variants={{
              hidden: { opacity: 0, scale: 0.98, y: 22 },
              visible: {
                opacity: 1,
                scale: 1,
                transition: {
                  duration: reducedMotion ? 0 : 0.55,
                  ease: [0.22, 1, 0.36, 1],
                },
                y: 0,
              },
            }}
          >
            <InvitationCard
              className="h-full"
              contentClassName="relative aspect-[4/5]"
              design={design}
              packageCode="signature"
              photo
            >
              <Image
                alt={image.alt}
                className="object-contain"
                fill
                sizes="33vw"
                src={image.src}
              />
            </InvitationCard>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

function useSignatureCarouselColumns() {
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }
    const query = window.matchMedia("(min-width: 768px)");
    const sync = () => setColumns(query.matches ? 3 : 1);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return columns;
}

function SignatureCarouselSection({
  design,
  gallery,
  id,
  premium,
}: {
  design: ThemeVisual;
  gallery: InvitationEnvelope["content"]["gallery"];
  id: boolean;
  premium: PremiumVisualConfig;
}) {
  const reducedMotion = useReducedMotion();
  const columns = useSignatureCarouselColumns();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const photos = sectionPhotosFromGallery(
    gallery,
    mediaSectionStartFor("signature", 10),
    9,
    signatureSectionTenPhotos,
  );
  const maxIndex = Math.max(photos.length - columns, 0);
  const boundedActiveIndex = Math.min(activeIndex, maxIndex);

  function moveTo(nextIndex: number) {
    const next = Math.min(Math.max(nextIndex, 0), maxIndex);
    setActiveIndex(next);
    window.requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      const slide = viewport?.children[next] as HTMLElement | undefined;
      if (!viewport || !slide) {
        return;
      }
      viewport.scrollTo({
        behavior: reducedMotion ? "auto" : "smooth",
        left: slide.offsetLeft,
      });
    });
  }

  return (
    <section
      className={`${design.page} relative overflow-hidden px-5 py-20 md:px-12 md:py-28`}
      data-signature-section="10"
    >
      <ThemeSectionDecoration front config={premium} showOverlay={false} />
      <div className="relative z-30 mx-auto max-w-7xl">
        <div
          className="grid snap-x snap-mandatory grid-flow-col auto-cols-[100%] gap-3 overflow-x-auto scroll-smooth [scrollbar-width:none] md:auto-cols-[calc((100%-1.5rem)/3)] [&::-webkit-scrollbar]:hidden"
          data-signature-carousel
          ref={viewportRef}
        >
          {photos.map((image, index) => (
            <div
              className="snap-start"
              data-signature-carousel-slide={index + 1}
              key={`${image.src}-${index}`}
            >
              <InvitationCard
                contentClassName="relative aspect-[4/5]"
                design={design}
                packageCode="signature"
                photo
              >
                <Image
                  alt={image.alt}
                  className="object-contain"
                  fill
                  loading="eager"
                  sizes="(max-width: 767px) 100vw, 33vw"
                  src={image.src}
                />
              </InvitationCard>
            </div>
          ))}
        </div>

        <button
          aria-label={id ? "Foto sebelumnya" : "Previous photo"}
          className={`${design.surface} ${design.glow} absolute left-3 top-1/2 z-30 grid size-12 -translate-y-1/2 place-items-center rounded-full border transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-35`}
          disabled={boundedActiveIndex === 0}
          onClick={() => moveTo(boundedActiveIndex - 1)}
          style={{ borderColor: design.cardBorderColor }}
          type="button"
        >
          <ChevronLeft aria-hidden size={22} />
        </button>
        <button
          aria-label={id ? "Foto berikutnya" : "Next photo"}
          className={`${design.surface} ${design.glow} absolute right-3 top-1/2 z-30 grid size-12 -translate-y-1/2 place-items-center rounded-full border transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-35`}
          disabled={boundedActiveIndex === maxIndex}
          onClick={() => moveTo(boundedActiveIndex + 1)}
          style={{ borderColor: design.cardBorderColor }}
          type="button"
        >
          <ChevronRight aria-hidden size={22} />
        </button>
      </div>
    </section>
  );
}

type CoutureTogglePhase =
  | "closed"
  | "opening-glow"
  | "opening-crossfade"
  | "opening-burst"
  | "open"
  | "closing";

const coutureRotatingThemes = new Set<RendererKey>([
  "floral-romantic",
  "islamic-soft",
  "javanese-traditional",
  "minimalist-white",
]);

function useCoutureToggle({
  assets,
  onEffect,
}: {
  assets: { closeSound: string; openSound: string };
  onEffect: (effectUrl: string) => void;
}) {
  const reducedMotion = useReducedMotion();
  const [opened, setOpened] = useState(false);
  const [phase, setPhase] = useState<CoutureTogglePhase>("closed");
  const timersRef = useRef<number[]>([]);
  const busy = phase.startsWith("opening") || phase === "closing";

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
    },
    [],
  );

  function later(callback: () => void, delay: number) {
    const timer = window.setTimeout(callback, delay);
    timersRef.current.push(timer);
  }

  function toggle() {
    if (busy) {
      return;
    }

    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];

    if (opened) {
      setPhase("closing");
      setOpened(false);
      onEffect(assets.closeSound);
      later(() => setPhase("closed"), reducedMotion ? 0 : 750);
      return;
    }

    if (reducedMotion) {
      setOpened(true);
      setPhase("open");
      onEffect(assets.openSound);
      return;
    }

    setPhase("opening-glow");
    later(() => {
      setPhase("opening-crossfade");
      onEffect(assets.openSound);
    }, 1000);
    later(() => {
      setOpened(true);
      setPhase("opening-burst");
    }, 2000);
    later(() => setPhase("open"), 3000);
  }

  return { busy, opened, phase, toggle };
}

function useCoutureToggleButton({
  design,
  invitation,
  label,
  onEffect,
  toggleId,
}: {
  design: ThemeVisual;
  invitation: InvitationEnvelope;
  label: string;
  onEffect: (effectUrl: string) => void;
  toggleId: string;
}) {
  const rendererKey = invitation.rendererKey as RendererKey;
  const brightPalette = brightPhotoBackgroundThemes.has(rendererKey);
  const assets =
    coutureToggleAssets[rendererKey] ?? coutureToggleAssets["elegant-classic"];
  const { busy, opened, phase, toggle } = useCoutureToggle({
    assets,
    onEffect,
  });
  const rotating = coutureRotatingThemes.has(rendererKey);
  const ritualMotionActive =
    phase === "opening-glow" || (!rotating && phase === "opening-crossfade");
  const afterActive =
    phase === "opening-crossfade" ||
    phase === "opening-burst" ||
    phase === "open";
  const burst = phase === "opening-burst";
  const glowStrength =
    phase === "closed" || phase === "closing"
      ? 0.28
      : phase === "opening-glow"
        ? 0.72
        : 1;

  return {
    busy,
    button: (
      <button
        aria-busy={busy}
        aria-expanded={opened}
        aria-label={label}
        className={`${coutureStyles.toggleButton} ${design.surface} ${design.glow} group relative grid size-20 place-items-center rounded-full border transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-current/45`}
        data-couture-toggle-border="glitter"
        data-couture-toggle-palette={
          brightPalette ? "theme-border-white-shine" : "theme"
        }
        data-couture-toggle={toggleId}
        data-couture-toggle-phase={phase}
        data-couture-toggle-surface="solid"
        data-motion={rotating ? "rotate" : "shake"}
        data-opening={ritualMotionActive || undefined}
        disabled={busy}
        onClick={toggle}
        style={
          {
            "--couture-toggle-border": design.cardBorderColor,
            "--couture-toggle-glow": design.cardGlowColor,
            "--couture-toggle-shine": design.cardShineColor,
            borderColor: design.cardBorderColor,
            boxShadow: `0 0 0 1px ${design.cardBorderColor}, 0 0 ${18 + glowStrength * 24}px color-mix(in srgb, ${design.cardGlowColor} ${Math.round(45 + glowStrength * 35)}%, transparent)`,
          } as React.CSSProperties
        }
        type="button"
      >
        <AnimatePresence>
          {burst ? (
            <motion.span
              animate={{ opacity: 0, scale: 2.45 }}
              aria-hidden
              className={`${coutureStyles.toggleBurst} pointer-events-none absolute inset-0 rounded-full border`}
              data-couture-light-burst="outside"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0.9, scale: 0.7 }}
              key={`${toggleId}-burst`}
              transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            />
          ) : null}
        </AnimatePresence>
        <span className={`${coutureStyles.toggleArtwork} absolute inset-3`}>
          {[
            { active: !afterActive, key: "before", src: assets.before },
            { active: afterActive, key: "after", src: assets.after },
          ].map((icon) => (
            <motion.span
              animate={{
                filter: icon.active ? "blur(0px)" : "blur(7px)",
                opacity: icon.active ? 1 : 0,
                scale: icon.active ? 1 : 0.88,
              }}
              aria-hidden
              className="absolute inset-0"
              initial={false}
              key={icon.key}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <Image
                alt=""
                className="object-contain"
                fill
                sizes="3.5rem"
                src={icon.src}
                unoptimized
              />
            </motion.span>
          ))}
        </span>
      </button>
    ),
    opened,
    phase,
  };
}

function CoutureBackgroundLayer({
  design,
  photos,
  sectionRef,
}: {
  design: ThemeVisual;
  photos: readonly GalleryPhoto[];
  sectionRef: React.RefObject<HTMLElement | null>;
}) {
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    offset: ["start end", "end start"],
    target: sectionRef,
  });
  const parallaxY = useTransform(scrollYProgress, [0, 1], ["-4%", "4%"]);
  const firstOpacity = useTransform(
    scrollYProgress,
    [0, 0.36, 0.46],
    [1, 1, photos.length > 1 ? 0 : 1],
  );
  const secondOpacity = useTransform(
    scrollYProgress,
    [0.28, 0.42, 0.64, 0.76],
    [0, 1, 1, photos.length > 2 ? 0 : 1],
  );
  const thirdOpacity = useTransform(
    scrollYProgress,
    [0.62, 0.78, 1],
    [0, 1, 1],
  );
  const opacityValues = [firstOpacity, secondOpacity, thirdOpacity] as const;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      data-couture-background-layer
    >
      <motion.div
        className="absolute -inset-y-[8%] inset-x-0 overflow-hidden"
        data-couture-background-canvas
        style={{ y: reducedMotion ? "0%" : parallaxY }}
      >
        {photos.map((photo, index) => (
          <motion.div
            className="absolute inset-0 overflow-hidden"
            data-couture-background={index + 1}
            key={`${photo.src}-${index}`}
            style={{
              opacity: photos.length === 1 ? 1 : opacityValues[index],
            }}
          >
            <Image
              alt=""
              className={`${coutureStyles.backgroundOrbit} object-cover object-center`}
              fill
              sizes="100vw"
              src={photo.src}
            />
          </motion.div>
        ))}
      </motion.div>
      <div
        className={`${design.surface} absolute inset-0 opacity-50`}
        data-couture-background-overlay="50"
      />
    </div>
  );
}

function CoutureCoupleRevealSection({
  design,
  invitation,
  onEffect,
  premium,
}: {
  design: ThemeVisual;
  invitation: InvitationEnvelope;
  onEffect: (effectUrl: string) => void;
  premium: PremiumVisualConfig;
}) {
  const id = invitation.locale === "id";
  const { couple, gallery } = invitation.content;
  const photos = sectionPhotosFromGallery(
    gallery,
    mediaSectionStartFor("couture", 2),
    2,
    coutureCouplePhotos,
  );
  const people = [
    {
      description:
        couple.partnerTwoDescription ?? (id ? "Mempelai pria" : "Groom"),
      name: couple.partnerTwo,
      photo: photos[0] ?? coutureCouplePhotos[0],
      role: "groom",
    },
    {
      description:
        couple.partnerOneDescription ?? (id ? "Mempelai wanita" : "Bride"),
      name: couple.partnerOne,
      photo: photos[1] ?? coutureCouplePhotos[1],
      role: "bride",
    },
  ] as const;
  const label = id
    ? "Buka atau tutup foto kedua mempelai"
    : "Reveal or hide the couple photos";
  const toggle = useCoutureToggleButton({
    design,
    invitation,
    label,
    onEffect,
    toggleId: "section-2",
  });

  return (
    <section
      className={`${design.page} relative overflow-hidden`}
      data-couture-section="2"
    >
      <ThemeSectionDecoration front config={premium} overlayFront showOverlay />
      <CouplePortraitPanels
        design={design}
        opened={toggle.opened}
        packageCode="couture"
        panelId="couture-couple-reveal-panels"
        people={people}
        toggle={toggle.button}
      />
    </section>
  );
}

function CoutureThreePhotoSection({
  design,
  gallery,
  premium,
}: {
  design: ThemeVisual;
  gallery: InvitationEnvelope["content"]["gallery"];
  premium: PremiumVisualConfig;
}) {
  const photos = sectionPhotosFromGallery(
    gallery,
    mediaSectionStartFor("couture", 4),
    3,
    coutureSectionFourPhotos,
  );
  return (
    <section
      className={`${design.page} relative overflow-hidden px-2 py-2`}
      data-couture-section="4"
    >
      <ThemeSectionDecoration front config={premium} overlayFront showOverlay />
      <div className="relative z-30 grid gap-2 md:grid-cols-3">
        {photos.map((image, index) => (
          <motion.div
            initial={{ opacity: 0, scale: 1.015 }}
            key={`${image.src}-${index}`}
            viewport={{ once: true, amount: 0.18 }}
            whileInView={{ opacity: 1, scale: 1 }}
          >
            <InvitationCard
              className="h-full"
              contentClassName={`relative min-h-[58svh] ${index === 1 ? "md:min-h-[70svh]" : ""}`}
              design={design}
              packageCode="couture"
              photo
            >
              <Image
                alt={image.alt}
                className="object-cover object-[center_28%]"
                fill
                sizes="(max-width: 767px) 100vw, 33vw"
                src={image.src}
              />
            </InvitationCard>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function CoutureQuadrantRevealSection({
  design,
  invitation,
  onEffect,
  premium,
}: {
  design: ThemeVisual;
  invitation: InvitationEnvelope;
  onEffect: (effectUrl: string) => void;
  premium: PremiumVisualConfig;
}) {
  const reducedMotion = useReducedMotion();
  const id = invitation.locale === "id";
  const photos = sectionPhotosFromGallery(
    invitation.content.gallery,
    mediaSectionStartFor("couture", 6),
    5,
    coutureSectionSixPhotos,
  );
  const cover = photos[0] ?? coutureSectionSixPhotos[0]!;
  const quadrants = photos.slice(1, 5);
  const hiddenPositions = [
    { x: "100%", y: "100%" },
    { x: "-100%", y: "100%" },
    { x: "100%", y: "-100%" },
    { x: "-100%", y: "-100%" },
  ] as const;
  const label = id
    ? "Buka atau tutup galeri empat foto"
    : "Reveal or hide the four-photo gallery";
  const toggle = useCoutureToggleButton({
    design,
    invitation,
    label,
    onEffect,
    toggleId: "section-6",
  });

  return (
    <section
      className={`${design.page} relative min-h-[100svh] overflow-hidden p-2`}
      data-ambient-over-background="true"
      data-couture-section="6"
    >
      <ThemeSectionDecoration front config={premium} overlayFront showOverlay />
      <div className="relative z-30 min-h-[calc(100svh-1rem)] overflow-hidden">
        <div
          className="absolute inset-0 overflow-hidden"
          data-couture-section-six-cover
        >
          <Image
            alt={cover.alt}
            className={`${coutureStyles.backgroundOrbit} object-cover object-[center_28%]`}
            fill
            sizes="100vw"
            src={cover.src}
          />
          <div
            className={`${design.surface} absolute inset-0 opacity-50`}
            data-couture-background-overlay="50"
          />
        </div>
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
          {quadrants.map((image, index) => (
            <motion.div
              animate={{
                opacity: toggle.opened ? 1 : 0,
                x: toggle.opened ? "0%" : hiddenPositions[index]?.x,
                y: toggle.opened ? "0%" : hiddenPositions[index]?.y,
              }}
              aria-hidden={!toggle.opened}
              className="relative min-h-0 min-w-0 will-change-transform"
              data-couture-quadrant={index + 1}
              initial={false}
              key={`${image.src}-${index}`}
              transition={{
                delay: reducedMotion
                  ? 0
                  : toggle.opened
                    ? index * 0.16
                    : (3 - index) * 0.16,
                duration: reducedMotion ? 0 : 0.62,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <InvitationCard
                className="!absolute inset-0 h-full"
                contentClassName="relative h-full"
                design={design}
                packageCode="couture"
                photo
                surfaceClassName="bg-transparent"
              >
                <Image
                  alt={image.alt}
                  className="object-cover object-[center_28%]"
                  fill
                  sizes="50vw"
                  src={image.src}
                />
              </InvitationCard>
            </motion.div>
          ))}
        </div>
        <div className="absolute left-1/2 top-1/2 z-[70] -translate-x-1/2 -translate-y-1/2">
          {toggle.button}
        </div>
      </div>
    </section>
  );
}

function CoutureNinePhotoGallery({
  design,
  gallery,
  premium,
}: {
  design: ThemeVisual;
  gallery: InvitationEnvelope["content"]["gallery"];
  premium: PremiumVisualConfig;
}) {
  const reducedMotion = useReducedMotion();
  const photos = sectionPhotosFromGallery(
    gallery,
    mediaSectionStartFor("couture", 8),
    9,
    coutureSectionEightPhotos,
  );
  return (
    <section
      className={`${design.page} relative overflow-hidden px-2 py-16 md:px-4 md:py-24`}
      data-couture-section="8"
    >
      <ThemeSectionDecoration front config={premium} overlayFront showOverlay />
      <motion.div
        className="relative z-30 grid grid-cols-3 gap-2 md:gap-3"
        initial={reducedMotion ? false : "hidden"}
        variants={{
          hidden: {},
          visible: {
            transition: { staggerChildren: reducedMotion ? 0 : 0.07 },
          },
        }}
        viewport={{ once: true, amount: 0.2 }}
        whileInView="visible"
      >
        {photos.map((image, index) => (
          <motion.div
            data-couture-gallery-item
            key={`${image.src}-${index}`}
            variants={{
              hidden: { opacity: 0, scale: 0.98, y: 22 },
              visible: {
                opacity: 1,
                scale: 1,
                transition: { duration: reducedMotion ? 0 : 0.55 },
                y: 0,
              },
            }}
          >
            <InvitationCard
              className="h-full"
              contentClassName="relative aspect-[4/5]"
              design={design}
              packageCode="couture"
              photo
            >
              <Image
                alt={image.alt}
                className="object-contain"
                fill
                sizes="33vw"
                src={image.src}
              />
            </InvitationCard>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

function CoutureCarouselSection({
  design,
  gallery,
  id,
  premium,
}: {
  design: ThemeVisual;
  gallery: InvitationEnvelope["content"]["gallery"];
  id: boolean;
  premium: PremiumVisualConfig;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const columns = useSignatureCarouselColumns();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const media = sectionPhotosFromGallery(
    gallery,
    mediaSectionStartFor("couture", 10),
    10,
    coutureSectionTenPhotos,
  );
  const background = [media[0] ?? coutureSectionTenPhotos[0]!];
  const photos = media.slice(1, 10);
  const maxIndex = Math.max(photos.length - columns, 0);
  const boundedActiveIndex = Math.min(activeIndex, maxIndex);

  function moveTo(nextIndex: number) {
    const next = Math.min(Math.max(nextIndex, 0), maxIndex);
    setActiveIndex(next);
    window.requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      const slide = viewport?.children[next] as HTMLElement | undefined;
      if (!viewport || !slide) {
        return;
      }
      viewport.scrollTo({
        behavior: reducedMotion ? "auto" : "smooth",
        left: slide.offsetLeft,
      });
    });
  }

  return (
    <section
      className={`${design.page} relative z-10 -mt-[18svh] min-h-[128svh] overflow-hidden px-5 pb-24 pt-[calc(6rem+18svh)] md:px-12 md:pb-32 md:pt-[calc(8rem+18svh)]`}
      data-ambient-over-background="true"
      data-couture-depth-entry="section-10-over-section-9"
      data-couture-section="10"
      ref={sectionRef}
    >
      <CoutureBackgroundLayer
        design={design}
        photos={background}
        sectionRef={sectionRef}
      />
      <ThemeSectionDecoration front config={premium} overlayFront showOverlay />
      <div className="relative z-30 mx-auto flex min-h-[80svh] max-w-7xl items-center">
        <div className="relative w-full">
          <div
            className="grid snap-x snap-mandatory grid-flow-col auto-cols-[100%] gap-3 overflow-x-auto scroll-smooth [scrollbar-width:none] md:auto-cols-[calc((100%-1.5rem)/3)] [&::-webkit-scrollbar]:hidden"
            data-couture-carousel
            ref={viewportRef}
          >
            {photos.map((image, index) => (
              <div
                className="snap-start"
                data-couture-carousel-slide={index + 1}
                key={`${image.src}-${index}`}
              >
                <InvitationCard
                  contentClassName="relative aspect-[4/5]"
                  design={design}
                  packageCode="couture"
                  photo
                >
                  <Image
                    alt={image.alt}
                    className="object-contain"
                    fill
                    sizes="(max-width: 767px) 100vw, 33vw"
                    src={image.src}
                  />
                </InvitationCard>
              </div>
            ))}
          </div>
          <button
            aria-label={id ? "Foto sebelumnya" : "Previous photo"}
            className={`${design.surface} ${design.glow} absolute left-3 top-1/2 z-40 grid size-12 -translate-y-1/2 place-items-center rounded-full border transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-35`}
            disabled={boundedActiveIndex === 0}
            onClick={() => moveTo(boundedActiveIndex - 1)}
            style={{ borderColor: design.cardBorderColor }}
            type="button"
          >
            <ChevronLeft aria-hidden size={22} />
          </button>
          <button
            aria-label={id ? "Foto berikutnya" : "Next photo"}
            className={`${design.surface} ${design.glow} absolute right-3 top-1/2 z-40 grid size-12 -translate-y-1/2 place-items-center rounded-full border transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-35`}
            disabled={boundedActiveIndex === maxIndex}
            onClick={() => moveTo(boundedActiveIndex + 1)}
            style={{ borderColor: design.cardBorderColor }}
            type="button"
          >
            <ChevronRight aria-hidden size={22} />
          </button>
        </div>
      </div>
    </section>
  );
}

function CoutureSlideshowSection({
  design,
  gallery,
  premium,
}: {
  design: ThemeVisual;
  gallery: InvitationEnvelope["content"]["gallery"];
  premium: PremiumVisualConfig;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { amount: 0.2, margin: "120px 0px" });
  const reducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const photos = sectionPhotosFromGallery(
    gallery,
    mediaSectionStartFor("couture", 12),
    3,
    coutureSectionTwelvePhotos,
  );

  useEffect(() => {
    if (reducedMotion || !inView || photos.length < 2) {
      return;
    }
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setActiveIndex((current) => (current + 1) % photos.length);
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [inView, photos.length, reducedMotion]);

  return (
    <section
      className={`${design.page} relative grid min-h-[100svh] place-items-center overflow-hidden px-4 py-20 md:px-12`}
      data-couture-section="12"
      ref={sectionRef}
    >
      <ThemeSectionDecoration front config={premium} overlayFront showOverlay />
      <div className="relative z-30 mx-auto w-full max-w-3xl">
        <InvitationCard
          contentClassName="relative aspect-[4/5] md:aspect-[5/4]"
          design={design}
          packageCode="couture"
          photo
        >
          {photos.map((image, index) => {
            const active = index === activeIndex;
            return (
              <motion.div
                animate={{
                  opacity: active ? 1 : 0,
                  scale: active && !reducedMotion ? 1.055 : 1,
                }}
                aria-hidden={!active}
                className="absolute inset-0"
                data-couture-slideshow-slide={index + 1}
                data-couture-slideshow-state={active ? "active" : "inactive"}
                initial={false}
                key={`${image.src}-${index}`}
                transition={{
                  opacity: { duration: reducedMotion ? 0 : 0.8 },
                  scale: { duration: reducedMotion ? 0 : 4, ease: "linear" },
                }}
              >
                <Image
                  alt={image.alt}
                  className="object-cover object-[center_28%]"
                  fill
                  sizes="(max-width: 767px) 100vw, 60vw"
                  src={image.src}
                />
              </motion.div>
            );
          })}
        </InvitationCard>
      </div>
    </section>
  );
}

function EssentialNinePhotoGallery({
  design,
  gallery,
}: {
  design: ThemeVisual;
  gallery: InvitationEnvelope["content"]["gallery"];
}) {
  const reducedMotion = useReducedMotion();
  const photos = sectionPhotosFromGallery(
    gallery,
    mediaSectionStartFor("essential", 6),
    9,
    essentialSectionSixPhotos,
  );

  return (
    <section
      className={`${design.page} relative overflow-hidden px-2 py-16 md:px-4 md:py-24`}
      data-essential-section="6"
    >
      <motion.div
        className="grid grid-cols-3 gap-2 md:gap-3"
        initial={reducedMotion ? false : "hidden"}
        variants={{
          hidden: {},
          visible: {
            transition: {
              staggerChildren: reducedMotion ? 0 : 0.07,
            },
          },
        }}
        viewport={{ once: true, amount: 0.2 }}
        whileInView="visible"
      >
        {photos.map((image, index) => (
          <motion.div
            data-essential-gallery-item
            key={`${image.src}-${index}`}
            variants={{
              hidden: {
                opacity: 0,
                scale: 0.98,
                y: 22,
              },
              visible: {
                opacity: 1,
                scale: 1,
                transition: {
                  duration: reducedMotion ? 0 : 0.55,
                  ease: [0.22, 1, 0.36, 1],
                },
                y: 0,
              },
            }}
          >
            <InvitationCard
              className="h-full"
              contentClassName="relative aspect-[4/5]"
              design={design}
              packageCode="essential"
              photo
            >
              <Image
                alt={image.alt}
                className="object-cover"
                fill
                sizes="33vw"
                src={image.src}
              />
            </InvitationCard>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

function EssentialGiftSection({
  design,
  invitation,
}: {
  design: ThemeVisual;
  invitation: InvitationEnvelope;
}) {
  const [opened, setOpened] = useState(false);
  const id = invitation.locale === "id";
  const account = getGiftAccount(invitation, id);

  return (
    <section
      className={`${design.surface} relative grid min-h-[78svh] place-items-center overflow-hidden px-6 py-24 text-center md:px-12`}
      data-essential-section="5"
    >
      <FadeText className="mx-auto max-w-3xl">
        <p
          className={`text-[0.6rem] uppercase tracking-[0.25em] ${design.accent}`}
        >
          {id ? "Gift" : "Gift"}
        </p>
        <h2 className="mt-8 font-serif text-[clamp(3rem,8vw,7rem)] leading-[0.86] tracking-[-0.05em]">
          {id ? "Tanda kasih." : "A token of love."}
        </h2>
        <p
          className={`mx-auto mt-7 max-w-xl text-sm leading-7 ${design.muted}`}
        >
          {id
            ? "Doa dan kehadiran Anda adalah hadiah utama. Jika ingin menitipkan tanda kasih, detail rekening tersedia di bawah ini."
            : "Your prayers and presence are the greatest gift. If you would like to send a token of love, the account detail is available below."}
        </p>
      </FadeText>

      <div className="relative z-10 mt-12 flex flex-col items-center">
        <GiftIconButton
          afterAlt="Gift opened"
          afterSrc="/images/invitation-essential/gift/gift-icon-opened.webp"
          beforeAlt="Gift"
          beforeSrc="/images/invitation-essential/gift/gift-icon.webp"
          borderClass={design.border}
          glowClass={design.glow}
          onOpen={() => setOpened(true)}
          opened={opened}
        />

        <AnimatePresence>
          {opened ? (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className={`mt-8 min-w-64 border px-7 py-5 ${design.border}`}
              exit={{ opacity: 0, y: 10 }}
              initial={{ opacity: 0, y: 14 }}
              transition={textFadeTransition}
            >
              <p
                className={`text-[0.58rem] uppercase tracking-[0.22em] ${design.accent}`}
              >
                {id ? "Rekening pengantin" : "Couple account"}
              </p>
              <p className="mt-3 font-serif text-2xl">{account.label}</p>
              {account.name ? (
                <p className={`mt-2 text-sm ${design.muted}`}>{account.name}</p>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  );
}

function getTimelineEntries(
  invitation: InvitationEnvelope,
  mode: "opening" | "middle" | "final",
) {
  const override = timelineOverride(invitation, mode);
  if (override) {
    return override;
  }

  const id = invitation.locale === "id";
  if (mode === "middle") {
    return id
      ? [
          [
            "04",
            "Tragedi Lembut",
            "Konflik yang turut mewarnai perjalanan dengan kontrol hati yang terarah.",
          ],
          [
            "05",
            "Sadar",
            "Ego tidak bisa melawan ego, masing-masing kami adalah rumah.",
          ],
          [
            "06",
            "Sabar",
            "Besar kecilnya masalah akan tetap kalah dengan tekad dan keteguhan hati yang selalu ingin bersama.",
          ],
        ]
      : [
          [
            "04",
            "A Gentle Tragedy",
            "Conflict colored the journey, yet our hearts learned to move with intention.",
          ],
          [
            "05",
            "Awake",
            "Ego cannot defeat ego; each of us learned that the other is home.",
          ],
          [
            "06",
            "Patient",
            "Every problem, big or small, bows to the resolve and steadfastness that keep choosing togetherness.",
          ],
        ];
  }

  if (mode === "final") {
    return id
      ? [
          [
            "07",
            "Mendengar",
            "Sebuah validasi yang berarti sebagai langkah awal untuk menumbuhkan rasa setiap hari.",
          ],
          [
            "08",
            "Maaf",
            "Bukan siapa yang paling salah, tapi siapa yang paling cinta, dan kami melakukannya.",
          ],
          [
            "09",
            "Hari Ini",
            "Kini perjalanan itu menuju hari yang kami rayakan bersama orang-orang terdekat.",
          ],
        ]
      : [
          [
            "07",
            "Listening",
            "A meaningful validation became the first step in growing love each day.",
          ],
          [
            "08",
            "Forgiveness",
            "It was never about who was most wrong, but who loved most, and we chose to do it.",
          ],
          [
            "09",
            "Today",
            "That journey now becomes a celebration shared with the people we love.",
          ],
        ];
  }

  return id
    ? [
        [
          "01",
          "Bertemu",
          "Sebuah awal yang sederhana membuka ruang untuk saling mengenal.",
        ],
        [
          "02",
          "Bertumbuh",
          "Cerita itu tumbuh melalui waktu, jarak, dan pilihan untuk tetap bersama.",
        ],
        [
          "03",
          "Suka Cita",
          "Rasa bahagia dan damai selalu tumbuh setiap hari membawa kesuburan.",
        ],
      ]
    : [
        [
          "01",
          "Meeting",
          "A simple beginning opened the way for two lives to know one another.",
        ],
        [
          "02",
          "Growing",
          "The story grew through time, distance, and the choice to keep returning.",
        ],
        [
          "03",
          "Joy",
          "Happiness and peace keep growing each day, bringing life into bloom.",
        ],
      ];
}

function getCoutureTimelineEntries(
  invitation: InvitationEnvelope,
  mode: "opening" | "conflict" | "intimacy" | "trust" | "final",
): TimelineEntries {
  const override = timelineOverride(invitation, mode);
  if (override) {
    return override;
  }

  const id = invitation.locale === "id";
  const entries = {
    opening: id
      ? [
          [
            "01",
            "Bertemu",
            "Sebuah awal yang sederhana yang membuka ruang untuk saling mengenal.",
          ],
          [
            "02",
            "Bertumbuh",
            "Cerita itu tumbuh melalui waktu, jarak, dan pilihan untuk tetap bersama.",
          ],
          [
            "03",
            "Suka Cita",
            "Rasa bahagia dan damai selalu tumbuh setiap hari membawa kesuburan.",
          ],
        ]
      : [
          [
            "01",
            "Meeting",
            "A simple beginning opened space for us to know one another.",
          ],
          [
            "02",
            "Growing",
            "The story grew through time, distance, and the choice to stay together.",
          ],
          [
            "03",
            "Joy",
            "Happiness and peace keep growing each day, bringing life into bloom.",
          ],
        ],
    conflict: id
      ? [
          [
            "04",
            "Tragedi Lembut",
            "Konflik yang turut mewarnai perjalanan dengan kontrol hati yang terarah.",
          ],
          [
            "05",
            "Sadar",
            "Ego tidak bisa melawan ego, masing-masing kami adalah rumah.",
          ],
          [
            "06",
            "Sabar",
            "Besar kecilnya masalah akan tetap kalah dengan tekad dan keteguhan hati yang selalu ingin bersama.",
          ],
        ]
      : [
          [
            "04",
            "A Gentle Tragedy",
            "Conflict colored the journey, guided by hearts learning direction.",
          ],
          [
            "05",
            "Awake",
            "Ego cannot defeat ego; each of us learned that the other is home.",
          ],
          [
            "06",
            "Patient",
            "Every problem, big or small, bows to the resolve and steadfastness that keep choosing togetherness.",
          ],
        ],
    intimacy: id
      ? [
          [
            "07",
            "Teliti",
            "Memperhatikan dan mengapresiasi hal-hal kecil untuk menjaga keintiman tetap hangat.",
          ],
          [
            "08",
            "Konsisten",
            "Naik turunnya rasa adalah hal rumit bagi kami, namun kemauan kami jauh lebih besar.",
          ],
          [
            "09",
            "Merajut",
            "Tetap saling melengkapi disaat hal-hal yang belum diketahui mulai terlihat sedikit demi sedikit.",
          ],
        ]
      : [
          [
            "07",
            "Attentive",
            "Noticing and appreciating small things keeps intimacy warm.",
          ],
          [
            "08",
            "Consistent",
            "The rise and fall of feelings can be complicated, yet our willingness is far greater.",
          ],
          [
            "09",
            "Weaving",
            "We keep completing one another as the unknown slowly begins to reveal itself.",
          ],
        ],
    trust: id
      ? [
          [
            "10",
            "Percaya",
            "Sedikit kecurigaan, lebih besar kepercayaan yang pada akhirnya saling mengikat.",
          ],
          [
            "11",
            "Memberi",
            "Bukan tentang materi, tapi sesuatu yang lebih berarti, tatapan yang jujur misalnya.",
          ],
          [
            "12",
            "Menguatkan",
            "Saling mendorong untuk meningkatkan nilai yang luhur dan mencapai hal-hal kecil untuk menunjang hal yang lebih besar. Salah satunya adalah kisah ini.",
          ],
        ]
      : [
          [
            "10",
            "Trust",
            "A little suspicion, but far greater trust, ultimately binding us together.",
          ],
          [
            "11",
            "Giving",
            "Not about material things, but something more meaningful, an honest gaze for example.",
          ],
          [
            "12",
            "Strengthening",
            "Encouraging one another to grow in noble value and accomplish small things that support something greater. One of them is this story.",
          ],
        ],
    final: id
      ? [
          [
            "11",
            "Mendengar",
            "Sebuah validasi yang berarti sebagai langkah awal untuk menumbuhkan rasa setiap hari.",
          ],
          [
            "12",
            "Maaf",
            "Bukan siapa yang paling salah, tapi siapa yang paling cinta, dan kami melakukannya.",
          ],
          [
            "13",
            "Hari Ini",
            "Kini perjalanan itu menuju hari yang kami rayakan bersama orang-orang terdekat.",
          ],
        ]
      : [
          [
            "11",
            "Listening",
            "A meaningful validation became the first step in growing love each day.",
          ],
          [
            "12",
            "Forgiveness",
            "It was never about who was most wrong, but who loved most, and we chose to do it.",
          ],
          [
            "13",
            "Today",
            "That journey now becomes a celebration shared with the people closest to us.",
          ],
        ],
  } satisfies Record<
    "opening" | "conflict" | "intimacy" | "trust" | "final",
    TimelineEntries
  >;

  return entries[mode];
}

function SignatureStoryTimelineSection({
  backgrounds,
  copyMode,
  design,
  includeIntro,
  includeQuote,
  invitation,
  mode,
  packageCode,
  premium,
  sectionNumber,
  showOverlay = false,
  timeline,
}: {
  backgrounds?: readonly GalleryPhoto[];
  copyMode?: "opening" | "middle" | "final" | "conflict" | "intimacy" | "trust";
  design: ThemeVisual;
  includeIntro: boolean;
  includeQuote: boolean;
  invitation: InvitationEnvelope;
  mode: "opening" | "middle" | "final";
  packageCode: "signature" | "couture";
  premium: PremiumVisualConfig;
  sectionNumber?: number;
  showOverlay?: boolean;
  timeline?: TimelineEntries;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const { couple, quote, story } = invitation.content;
  const id = invitation.locale === "id";
  const timelineEntries = timeline ?? getTimelineEntries(invitation, mode);
  const resolvedCopyMode = copyMode ?? mode;
  const sectionCopy =
    resolvedCopyMode === "opening"
      ? undefined
      : story.sectionBodies?.[resolvedCopyMode];
  const copy =
    sectionCopy ??
    (resolvedCopyMode === "middle" ||
    resolvedCopyMode === "conflict" ||
    resolvedCopyMode === "intimacy" ||
    resolvedCopyMode === "trust"
      ? id
        ? "Dari percakapan kecil, kami belajar merawat arah yang sama. Setiap musim membuat cerita ini semakin tenang dan utuh."
        : "From small conversations, we learned to care for the same direction. Every season made the story steadier and whole."
      : resolvedCopyMode === "final"
        ? id
          ? "Kami membawa cerita ini ke hadapan keluarga dan sahabat, dengan rasa syukur atas perjalanan yang membentuk kami."
          : "We bring this story before family and friends, grateful for every step that shaped us."
        : story.body);
  const coutureTextClass =
    packageCode === "couture" ? coutureStyles.readableText : "";
  const brightPhotoCopy =
    packageCode === "couture" &&
    Boolean(backgrounds?.length) &&
    brightPhotoBackgroundThemes.has(invitation.rendererKey as RendererKey);
  const deepBackground =
    packageCode === "couture" &&
    sectionNumber === 9 &&
    Boolean(backgrounds?.length);
  const sectionSpacing = deepBackground
    ? "px-6 pb-[calc(6rem+18svh)] pt-24 md:px-12 md:pb-[calc(9rem+18svh)] md:pt-36"
    : "px-6 py-24 md:px-12 md:py-36";

  return (
    <section
      className={`relative overflow-hidden ${sectionSpacing} ${backgrounds?.length ? "min-h-[130svh]" : ""} ${deepBackground ? "z-0" : ""}`}
      data-ambient-over-background={backgrounds?.length ? "true" : undefined}
      data-couture-background-depth={deepBackground ? "deep" : undefined}
      data-couture-section={
        packageCode === "couture" ? sectionNumber : undefined
      }
      data-signature-section={
        packageCode === "signature" ? sectionNumber : undefined
      }
      ref={sectionRef}
    >
      {backgrounds?.length ? (
        <CoutureBackgroundLayer
          design={design}
          photos={backgrounds}
          sectionRef={sectionRef}
        />
      ) : null}
      <ThemeSectionDecoration
        front={Boolean(backgrounds?.length)}
        config={premium}
        showOverlay={showOverlay}
      />
      <div
        className={`relative z-30 mx-auto grid max-w-6xl gap-14 ${
          includeIntro ? "lg:grid-cols-[0.85fr_1.15fr]" : ""
        }`}
      >
        {includeIntro ? (
          <motion.div
            className={coutureTextClass}
            initial={{ opacity: 0, x: -34 }}
            transition={textFadeTransition}
            viewport={{ once: true, amount: 0.3 }}
            whileInView={{ opacity: 1, x: 0 }}
          >
            <p className={`text-5xl ${design.accent}`} aria-hidden>
              {couple.monogram}
            </p>
            <h2 className="mt-8 font-serif text-[clamp(3rem,7vw,6rem)] leading-[0.88] tracking-[-0.045em]">
              {story.heading}
            </h2>
          </motion.div>
        ) : null}

        <motion.div
          className={includeIntro ? "lg:pt-20" : "mx-auto max-w-4xl"}
          initial={{ opacity: 0, y: 34 }}
          transition={{ ...textFadeTransition, delay: 0.12 }}
          viewport={{ once: true, amount: 0.3 }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <p
            className={`text-lg leading-9 ${design.muted} ${coutureTextClass} ${brightPhotoCopy ? coutureStyles.brightPhotoCopy : ""}`}
            data-couture-text-contrast={
              packageCode === "couture"
                ? brightPhotoCopy
                  ? "bright-photo"
                  : "enhanced"
                : undefined
            }
          >
            {copy}
          </p>
          <div className="mt-12 grid gap-3 md:grid-cols-3">
            {timelineEntries.map(([number, title, description]) => (
              <InvitationCard
                contentClassName="p-6"
                design={design}
                key={number}
                packageCode={packageCode}
              >
                <h3 className="font-serif text-2xl">{title}</h3>
                <p className={`mt-4 text-sm leading-7 ${design.muted}`}>
                  {description}
                </p>
              </InvitationCard>
            ))}
          </div>

          {includeQuote ? (
            <blockquote
              className={`mt-14 border-l pl-7 ${design.border} ${coutureTextClass}`}
            >
              <p className="font-sans text-2xl italic leading-9">
                &quot;{quote.text}&quot;
              </p>
              <footer className="mt-5 text-[0.6rem] uppercase tracking-[0.2em] opacity-55">
                {quote.attribution}
              </footer>
            </blockquote>
          ) : null}
        </motion.div>
      </div>
    </section>
  );
}

function SignatureRsvpPreviewSection({
  design,
  invitation,
  packageCode,
  premium,
  rsvpSlot,
  sectionNumber,
  showOverlay = false,
}: {
  design: ThemeVisual;
  invitation: InvitationEnvelope;
  packageCode: "signature" | "couture";
  premium: PremiumVisualConfig;
  rsvpSlot?: React.ReactNode;
  sectionNumber?: number;
  showOverlay?: boolean;
}) {
  const id = invitation.locale === "id";

  if (rsvpSlot) {
    return (
      <section
        className={`${design.surface} relative overflow-hidden px-5 py-20 md:px-12 md:py-32`}
        data-couture-section={
          packageCode === "couture" ? sectionNumber : undefined
        }
        data-signature-section={
          packageCode === "signature" ? sectionNumber : undefined
        }
      >
        <ThemeSectionDecoration config={premium} showOverlay={showOverlay} />
        <div className="relative z-30 mx-auto max-w-4xl">
          <InvitationCard
            contentClassName="p-1 md:p-2"
            design={design}
            packageCode={packageCode}
          >
            {rsvpSlot}
          </InvitationCard>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`${design.surface} relative overflow-hidden px-6 py-24 md:px-12 md:py-36`}
      data-couture-section={
        packageCode === "couture" ? sectionNumber : undefined
      }
      data-signature-section={
        packageCode === "signature" ? sectionNumber : undefined
      }
    >
      <ThemeSectionDecoration config={premium} showOverlay={showOverlay} />
      <InvitationCard
        className="relative z-30 mx-auto max-w-4xl"
        contentClassName="grid gap-7 p-6 md:p-10"
        design={design}
        packageCode={packageCode}
      >
        <div>
          <p
            className={`text-[0.6rem] uppercase tracking-[0.25em] ${design.accent}`}
          >
            RSVP
          </p>
          <h2 className="mt-4 font-serif text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.9] tracking-[-0.04em]">
            {id ? "Konfirmasi kehadiran." : "Confirm your attendance."}
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className={`border px-4 py-3 text-sm ${design.border}`}>
            {id ? "Hadir" : "Attending"}
          </div>
          <div className={`border px-4 py-3 text-sm ${design.border}`}>1</div>
          <div
            className={`min-h-28 border px-4 py-3 text-sm ${design.border} md:col-span-2`}
          >
            {id ? "Ucapan untuk kedua mempelai" : "Your wishes for the couple"}
          </div>
        </div>
        <button
          className={`inline-flex min-h-12 items-center justify-center gap-3 border px-5 text-[0.62rem] font-bold uppercase tracking-[0.18em] ${design.border}`}
          type="button"
        >
          <Send size={15} />
          {id ? "Kirim RSVP" : "Send RSVP"}
        </button>
      </InvitationCard>
    </section>
  );
}

function SignatureGiftSection({
  design,
  invitation,
  premium,
}: {
  design: ThemeVisual;
  invitation: InvitationEnvelope;
  premium: PremiumVisualConfig;
}) {
  const [opened, setOpened] = useState(false);
  const id = invitation.locale === "id";
  const account = getGiftAccount(invitation, id);
  const folder = signatureGiftFolders[invitation.rendererKey as RendererKey];

  return (
    <section
      className={`${design.surface} relative grid min-h-[78svh] place-items-center overflow-hidden px-6 py-24 text-center md:px-12`}
      data-signature-section="12"
    >
      <ThemeSectionDecoration config={premium} showOverlay={false} />
      <FadeText className="relative z-30 mx-auto max-w-3xl">
        <p
          className={`text-[0.6rem] uppercase tracking-[0.25em] ${design.accent}`}
        >
          {id ? "Gift" : "Gift"}
        </p>
        <h2 className="mt-8 font-serif text-[clamp(3rem,8vw,7rem)] leading-[0.86] tracking-[-0.05em]">
          {id ? "Tanda kasih." : "A token of love."}
        </h2>
        <p
          className={`mx-auto mt-7 max-w-xl text-sm leading-7 ${design.muted}`}
        >
          {id
            ? "Doa dan kehadiran Anda adalah hadiah utama. Jika ingin menitipkan tanda kasih, detail rekening tersedia di bawah ini."
            : "Your prayers and presence are the greatest gift. If you would like to send a token of love, the account detail is available below."}
        </p>
      </FadeText>

      <div className="relative z-10 mt-12 flex flex-col items-center">
        <GiftIconButton
          afterAlt="Gift opened"
          afterSrc={`/images/invitation-signature/gift/${folder}/after-tap.webp`}
          beforeAlt="Gift"
          beforeSrc={`/images/invitation-signature/gift/${folder}/before-tap.webp`}
          borderClass={design.border}
          glowClass={design.glow}
          onOpen={() => setOpened(true)}
          opened={opened}
        />

        <AnimatePresence>
          {opened ? (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className={`mt-8 min-w-64 border px-7 py-5 ${design.border}`}
              exit={{ opacity: 0, y: 10 }}
              initial={{ opacity: 0, y: 14 }}
              transition={textFadeTransition}
            >
              <p
                className={`text-[0.58rem] uppercase tracking-[0.22em] ${design.accent}`}
              >
                {id ? "Rekening pengantin" : "Couple account"}
              </p>
              <p className="mt-3 font-serif text-2xl">{account.label}</p>
              {account.name ? (
                <p className={`mt-2 text-sm ${design.muted}`}>{account.name}</p>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  );
}

function CoutureGiftSection({
  design,
  invitation,
  onGiftEffect,
  premium,
}: {
  design: ThemeVisual;
  invitation: InvitationEnvelope;
  onGiftEffect: (effectUrl: string) => void;
  premium: PremiumVisualConfig;
}) {
  const [opened, setOpened] = useState(false);
  const effectPlayedRef = useRef(false);
  const id = invitation.locale === "id";
  const account = getGiftAccount(invitation, id);
  const folder = signatureGiftFolders[invitation.rendererKey as RendererKey];
  const effectUrl =
    coutureGiftSoundEffects[invitation.rendererKey as RendererKey];

  function openGift() {
    setOpened(true);
    if (effectPlayedRef.current) {
      return;
    }
    effectPlayedRef.current = true;
    onGiftEffect(effectUrl);
  }

  return (
    <section
      className={`${design.surface} relative grid min-h-[78svh] place-items-center overflow-hidden px-6 py-24 text-center md:px-12`}
      data-couture-section="15"
    >
      <ThemeSectionDecoration config={premium} showOverlay />
      <FadeText
        className={`relative z-30 mx-auto max-w-3xl ${coutureStyles.readableText}`}
      >
        <p
          className={`text-[0.6rem] uppercase tracking-[0.25em] ${design.accent}`}
        >
          {id ? "Gift" : "Gift"}
        </p>
        <h2 className="mt-8 font-serif text-[clamp(3rem,8vw,7rem)] leading-[0.86] tracking-[-0.05em]">
          {id ? "Tanda kasih." : "A token of love."}
        </h2>
        <p
          className={`mx-auto mt-7 max-w-xl text-sm leading-7 ${design.muted}`}
        >
          {id
            ? "Doa dan kehadiran Anda adalah hadiah utama. Jika ingin menitipkan tanda kasih, detail rekening tersedia di bawah ini."
            : "Your prayers and presence are the greatest gift. If you would like to send a token of love, the account detail is available below."}
        </p>
      </FadeText>

      <div className="relative z-30 mt-12 flex flex-col items-center">
        <InvitationCard
          className="rounded-full"
          contentClassName="rounded-full"
          context="gift"
          design={design}
          packageCode="couture"
        >
          <GiftIconButton
            afterAlt="Gift opened"
            afterSrc={`/images/invitation-couture/gift/${folder}/after-tap.webp`}
            beforeAlt="Gift"
            beforeSrc={`/images/invitation-couture/gift/${folder}/before-tap.webp`}
            borderClass={design.border}
            glowClass={design.glow}
            onOpen={openGift}
            opened={opened}
          />
        </InvitationCard>

        <AnimatePresence>
          {opened ? (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className={`mt-8 min-w-64 border px-7 py-5 ${design.border}`}
              exit={{ opacity: 0, y: 10 }}
              initial={{ opacity: 0, y: 14 }}
              transition={textFadeTransition}
            >
              <p
                className={`text-[0.58rem] uppercase tracking-[0.22em] ${design.accent}`}
              >
                {id ? "Rekening pengantin" : "Couple account"}
              </p>
              <p className="mt-3 font-serif text-2xl">{account.label}</p>
              {account.name ? (
                <p className={`mt-2 text-sm ${design.muted}`}>{account.name}</p>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  );
}

function EventDetailsGrid({
  event,
  design,
  id,
  packageCode,
}: {
  event: InvitationEnvelope["content"]["event"];
  design: ThemeVisual;
  id: boolean;
  packageCode: PackageCode;
}) {
  const eventDetails = [
    {
      key: "ceremony",
      label: event.ceremonyLabel,
      time: event.ceremonyTime,
      venue: event.ceremonyVenue || event.venue,
      address: event.ceremonyAddress || event.address,
      mapUrl: event.ceremonyMapUrl || event.mapUrl,
    },
    {
      key: "reception",
      label: event.receptionLabel,
      time: event.receptionTime,
      venue: event.receptionVenue || event.venue,
      address: event.receptionAddress || event.address,
      mapUrl: event.receptionMapUrl || event.mapUrl,
    },
  ];

  return (
    <div className="mt-16 grid gap-3 md:grid-cols-2">
      {eventDetails.map((detail, index) => (
        <FadeText delay={index * 0.08} key={detail.key}>
          <InvitationCard
            contentClassName="p-7"
            design={design}
            packageCode={packageCode}
          >
            <CalendarDays size={19} />
            <p className="mt-9 text-[0.6rem] uppercase tracking-[0.18em] opacity-55">
              {detail.label}
            </p>
            <p className="mt-3 font-serif text-2xl leading-8">{detail.time}</p>
            <div className={`mt-7 border-t pt-6 ${design.border}`}>
              <MapPin size={18} />
              <p className="mt-4 text-[0.6rem] uppercase tracking-[0.18em] opacity-55">
                {detail.venue}
              </p>
              <p className={`mt-3 text-sm leading-7 ${design.muted}`}>
                {detail.address}
              </p>
              <a
                aria-label={`${id ? "Buka peta" : "Open map"} ${detail.label}`}
                className={`mt-6 flex w-fit items-center gap-2 border-b pb-1 text-[0.62rem] uppercase tracking-[0.18em] ${design.border}`}
                href={detail.mapUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <MapPin size={14} />
                {id ? `Peta ${detail.label}` : `${detail.label} map`}
              </a>
            </div>
          </InvitationCard>
        </FadeText>
      ))}
    </div>
  );
}

function EventStory({
  invitation,
  packageCode,
  design,
  onCoutureEffect,
  premium,
  rsvpSlot,
}: {
  invitation: InvitationEnvelope;
  packageCode: PackageCode;
  design: ThemeVisual;
  onCoutureEffect: (effectUrl: string) => void;
  premium: PremiumVisualConfig;
  rsvpSlot?: React.ReactNode;
}) {
  const { event, story, quote, gallery } = invitation.content;
  const id = invitation.locale === "id";
  const capability = packageCapabilities[packageCode];
  const revealDistance = capability.motion === "refined" ? 46 : 28;
  const legacyGallery = sectionPhotosFromGallery(
    gallery,
    0,
    3,
    essentialSectionFourPhotos,
  );

  if (packageCode === "signature") {
    return (
      <>
        <motion.section
          className={`${design.surface} relative overflow-hidden px-6 py-24 md:px-12 md:py-36`}
          data-signature-section="1"
          initial={{ opacity: 0, y: revealDistance }}
          transition={{ duration: 0.85 }}
          viewport={{ once: true, amount: 0.18 }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <ThemeSectionDecoration config={premium} showOverlay={false} />
          <div className="relative z-30 mx-auto max-w-6xl">
            <FadeText className="text-center">
              <p className="text-[0.6rem] uppercase tracking-[0.25em] opacity-55">
                {id ? "Waktu & Tempat" : "Time & Place"}
              </p>
              <h2 className="mx-auto mt-7 max-w-4xl font-serif text-[clamp(3rem,8vw,7rem)] leading-[0.86] tracking-[-0.05em]">
                {event.dateLabel}
              </h2>
            </FadeText>
            <EventDetailsGrid
              design={design}
              event={event}
              id={id}
              packageCode="signature"
            />
          </div>
        </motion.section>

        <SignatureCoupleRevealSection
          design={design}
          invitation={invitation}
          premium={premium}
        />
        <SignatureStoryTimelineSection
          design={design}
          includeIntro
          includeQuote={false}
          invitation={invitation}
          mode="opening"
          packageCode="signature"
          premium={premium}
          sectionNumber={3}
        />
        <SignatureThreePhotoSection
          design={design}
          gallery={gallery}
          premium={premium}
        />
        <SignatureStoryTimelineSection
          design={design}
          includeIntro={false}
          includeQuote={false}
          invitation={invitation}
          mode="middle"
          packageCode="signature"
          premium={premium}
          sectionNumber={5}
        />
        <SignatureQuadrantRevealSection
          design={design}
          invitation={invitation}
          premium={premium}
        />
        <SignatureStoryTimelineSection
          design={design}
          includeIntro={false}
          includeQuote
          invitation={invitation}
          mode="final"
          packageCode="signature"
          premium={premium}
          sectionNumber={7}
        />
        <SignatureNinePhotoGallery
          design={design}
          gallery={gallery}
          premium={premium}
        />
        <SignatureRsvpPreviewSection
          design={design}
          invitation={invitation}
          packageCode="signature"
          premium={premium}
          rsvpSlot={rsvpSlot}
          sectionNumber={9}
        />
        <SignatureCarouselSection
          design={design}
          gallery={gallery}
          id={id}
          premium={premium}
        />
      </>
    );
  }

  if (packageCode === "couture") {
    return (
      <>
        <motion.section
          className={`${design.surface} relative overflow-hidden px-6 py-24 md:px-12 md:py-36`}
          data-couture-section="1"
          initial={{ opacity: 0, y: revealDistance }}
          transition={{ duration: 0.85 }}
          viewport={{ once: true, amount: 0.18 }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <ThemeSectionDecoration config={premium} showOverlay />
          <div className="relative z-30 mx-auto max-w-6xl">
            <FadeText className={`text-center ${coutureStyles.readableText}`}>
              <p className="text-[0.6rem] uppercase tracking-[0.25em] opacity-55">
                {id ? "Waktu & Tempat" : "Time & Place"}
              </p>
              <h2 className="mx-auto mt-7 max-w-4xl font-serif text-[clamp(3rem,8vw,7rem)] leading-[0.86] tracking-[-0.05em]">
                {event.dateLabel}
              </h2>
            </FadeText>
            <EventDetailsGrid
              design={design}
              event={event}
              id={id}
              packageCode="couture"
            />
          </div>
        </motion.section>

        <CoutureCoupleRevealSection
          design={design}
          invitation={invitation}
          onEffect={onCoutureEffect}
          premium={premium}
        />
        <SignatureStoryTimelineSection
          design={design}
          includeIntro
          includeQuote={false}
          invitation={invitation}
          mode="opening"
          packageCode="couture"
          premium={premium}
          sectionNumber={3}
          showOverlay
          timeline={getCoutureTimelineEntries(invitation, "opening")}
        />
        <CoutureThreePhotoSection
          design={design}
          gallery={gallery}
          premium={premium}
        />
        <SignatureStoryTimelineSection
          backgrounds={sectionPhotosFromGallery(
            gallery,
            mediaSectionStartFor("couture", 5),
            1,
            coutureSectionFiveBackground,
          )}
          copyMode="conflict"
          design={design}
          includeIntro={false}
          includeQuote={false}
          invitation={invitation}
          mode="middle"
          packageCode="couture"
          premium={premium}
          sectionNumber={5}
          showOverlay
          timeline={getCoutureTimelineEntries(invitation, "conflict")}
        />
        <CoutureQuadrantRevealSection
          design={design}
          invitation={invitation}
          onEffect={onCoutureEffect}
          premium={premium}
        />
        <SignatureStoryTimelineSection
          copyMode="intimacy"
          design={design}
          includeIntro={false}
          includeQuote={false}
          invitation={invitation}
          mode="middle"
          packageCode="couture"
          premium={premium}
          sectionNumber={7}
          showOverlay
          timeline={getCoutureTimelineEntries(invitation, "intimacy")}
        />
        <CoutureNinePhotoGallery
          design={design}
          gallery={gallery}
          premium={premium}
        />
        <SignatureStoryTimelineSection
          backgrounds={sectionPhotosFromGallery(
            gallery,
            mediaSectionStartFor("couture", 9),
            3,
            coutureSectionNineBackgrounds,
          )}
          copyMode="trust"
          design={design}
          includeIntro={false}
          includeQuote={false}
          invitation={invitation}
          mode="middle"
          packageCode="couture"
          premium={premium}
          sectionNumber={9}
          showOverlay
          timeline={getCoutureTimelineEntries(invitation, "trust")}
        />
        <CoutureCarouselSection
          design={design}
          gallery={gallery}
          id={id}
          premium={premium}
        />
        <SignatureStoryTimelineSection
          design={design}
          includeIntro={false}
          includeQuote
          invitation={invitation}
          mode="final"
          packageCode="couture"
          premium={premium}
          sectionNumber={11}
          showOverlay
          timeline={getCoutureTimelineEntries(invitation, "final")}
        />
        <CoutureSlideshowSection
          design={design}
          gallery={gallery}
          premium={premium}
        />
      </>
    );
  }

  if (packageCode === "essential") {
    return (
      <>
        <motion.section
          className={`${design.surface} relative overflow-hidden px-6 py-24 md:px-12 md:py-36`}
          data-essential-section="1"
          initial={{ opacity: 0, y: revealDistance }}
          transition={{ duration: 0.85 }}
          viewport={{ once: true, amount: 0.18 }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <div className="relative z-30 mx-auto max-w-6xl">
            <FadeText className="text-center">
              <p className="text-[0.6rem] uppercase tracking-[0.25em] opacity-55">
                {id ? "Waktu & Tempat" : "Time & Place"}
              </p>
              <h2 className="mx-auto mt-7 max-w-4xl font-serif text-[clamp(3rem,8vw,7rem)] leading-[0.86] tracking-[-0.05em]">
                {event.dateLabel}
              </h2>
            </FadeText>
            <EventDetailsGrid
              design={design}
              event={event}
              id={id}
              packageCode="essential"
            />
          </div>
        </motion.section>

        <EssentialCoupleRevealSection design={design} invitation={invitation} />

        <section
          className="relative overflow-hidden px-6 py-24 md:px-12 md:py-36"
          data-essential-section="3"
        >
          <InvitationCard
            className="relative z-30 mx-auto max-w-6xl"
            contentClassName="grid gap-14 p-7 md:p-12 lg:grid-cols-[0.85fr_1.15fr]"
            design={design}
            packageCode="essential"
          >
            <motion.div
              initial={{ opacity: 0, x: -revealDistance }}
              transition={textFadeTransition}
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
              transition={{ ...textFadeTransition, delay: 0.12 }}
              viewport={{ once: true, amount: 0.3 }}
              whileInView={{ opacity: 1, y: 0 }}
            >
              <p className={`text-lg leading-9 ${design.muted}`}>
                {story.body}
              </p>
              <blockquote className={`mt-14 border-l pl-7 ${design.border}`}>
                <p className="font-sans text-2xl italic leading-9">
                  &quot;{quote.text}&quot;
                </p>
                <footer className="mt-5 text-[0.6rem] uppercase tracking-[0.2em] opacity-55">
                  {quote.attribution}
                </footer>
              </blockquote>
            </motion.div>
          </InvitationCard>
        </section>

        <EssentialPhotoSection
          design={design}
          photos={sectionPhotosFromGallery(
            gallery,
            mediaSectionStartFor("essential", 4),
            3,
            essentialSectionFourPhotos,
          )}
          title={id ? "Galeri lanjutan" : "Additional gallery"}
          variant="three"
        />
        <EssentialGiftSection design={design} invitation={invitation} />
        <EssentialNinePhotoGallery design={design} gallery={gallery} />
      </>
    );
  }

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
          <FadeText className="text-center">
            <p className="text-[0.6rem] uppercase tracking-[0.25em] opacity-55">
              {id ? "Waktu & Tempat" : "Time & Place"}
            </p>
            <h2 className="mx-auto mt-7 max-w-4xl font-serif text-[clamp(3rem,8vw,7rem)] leading-[0.86] tracking-[-0.05em]">
              {event.dateLabel}
            </h2>
          </FadeText>
          <EventDetailsGrid
            design={design}
            event={event}
            id={id}
            packageCode={packageCode}
          />
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
            transition={textFadeTransition}
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
            transition={{ ...textFadeTransition, delay: 0.12 }}
            viewport={{ once: true, amount: 0.3 }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <p className={`text-lg leading-9 ${design.muted}`}>{story.body}</p>
            <blockquote className={`mt-14 border-l pl-7 ${design.border}`}>
              <p className="font-sans text-2xl italic leading-9">
                &quot;{quote.text}&quot;
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
          {legacyGallery.map((image, index) => (
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
  cover,
  rsvpSlot,
  weather,
}: RendererV2Props) {
  const rendererKey = invitation.rendererKey as RendererKey;
  const design = themeVisualConfig[rendererKey];
  const premium = getPremiumVisualConfig(rendererKey, packageCode);
  const reducedMotion = useReducedMotion();
  const [opened, setOpened] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const effectAudioRef = useRef<HTMLAudioElement | null>(null);
  const effectRestoreRef = useRef<(() => void) | null>(null);
  const backgroundVolumeRef = useRef<number | null>(null);
  const ambientRef = useRef<HTMLDivElement>(null);
  const { closing, couple } = invitation.content;
  const essential = packageCode === "essential";
  const signature = packageCode === "signature";
  const couture = packageCode === "couture";
  const ambientStyle = {
    "--ambient-dot-color": design.cardBorderColor,
    "--ambient-dot-highlight": design.cardGlowColor,
  } as React.CSSProperties;

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
      effectAudioRef.current?.pause();
      effectRestoreRef.current?.();
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

  useEffect(() => {
    const root = ambientRef.current;
    if (!opened || !root || reducedMotion) {
      return;
    }

    const visibility = new Map<Element, boolean>();
    const syncState = (element: Element) => {
      const active =
        document.visibilityState === "visible" &&
        visibility.get(element) === true;
      (element as HTMLElement).dataset.ambientActive = String(active);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          visibility.set(entry.target, entry.isIntersecting);
          syncState(entry.target);
        });
      },
      { rootMargin: "180px 0px", threshold: 0.01 },
    );
    const sections = Array.from(root.querySelectorAll("section"));
    sections.forEach((section) => {
      visibility.set(section, false);
      observer.observe(section);
    });
    const syncVisibility = () => sections.forEach(syncState);
    document.addEventListener("visibilitychange", syncVisibility);

    return () => {
      document.removeEventListener("visibilitychange", syncVisibility);
      observer.disconnect();
      sections.forEach((section) => {
        delete (section as HTMLElement).dataset.ambientActive;
      });
    };
  }, [opened, reducedMotion]);

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

  async function playEffect(effectUrl: string) {
    const backgroundAudio = audioRef.current;
    effectAudioRef.current?.pause();
    effectRestoreRef.current?.();
    const previousVolume =
      backgroundVolumeRef.current ??
      backgroundAudio?.volume ??
      audio?.default_volume ??
      0.55;
    backgroundVolumeRef.current = previousVolume;

    if (backgroundAudio) {
      backgroundAudio.volume = Math.max(0.08, previousVolume * 0.28);
    }

    const effect = new Audio(effectUrl);
    effect.volume = 0.9;
    effectAudioRef.current = effect;

    const restoreVolume = () => {
      if (effectAudioRef.current !== effect) {
        return;
      }
      if (backgroundAudio) {
        backgroundAudio.volume = previousVolume;
      }
      backgroundVolumeRef.current = null;
      effectAudioRef.current = null;
      effectRestoreRef.current = null;
      effect.removeEventListener("ended", restoreVolume);
      effect.removeEventListener("error", restoreVolume);
    };

    effect.addEventListener("ended", restoreVolume);
    effect.addEventListener("error", restoreVolume);
    effectRestoreRef.current = restoreVolume;

    try {
      await effect.play();
    } catch {
      restoreVolume();
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <article
        className={`${design.page} min-h-screen`}
        data-body-font={design.bodyFontName}
        data-heading-font={design.headingFontName}
        data-invitation-motion
        data-package={packageCode}
        data-theme={invitation.rendererKey}
        style={
          {
            "--font-sans": design.bodyFontFamily,
            "--font-serif": design.headingFontFamily,
            fontFamily: design.bodyFontFamily,
          } as React.CSSProperties
        }
      >
        <AnimatePresence>
          {!opened ? (
            <Cover
              audio={audio}
              audioAvailable={Boolean(audio)}
              cover={cover}
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
          <div
            className={opened ? ambientStyles.scope : undefined}
            data-ambient-dots={opened ? packageCode : undefined}
            data-dot-tier={opened ? packageCode : undefined}
            ref={ambientRef}
            style={opened ? ambientStyle : undefined}
          >
            <EventStory
              design={design}
              invitation={invitation}
              onCoutureEffect={(effectUrl) => {
                void playEffect(effectUrl);
              }}
              packageCode={packageCode}
              premium={premium}
              rsvpSlot={rsvpSlot}
            />
            {!essential ? (
              <div
                className="relative overflow-hidden"
                data-couture-section={couture ? "13" : undefined}
                data-signature-section={signature ? "11" : undefined}
              >
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
            ) : null}
            {signature ? (
              <SignatureGiftSection
                design={design}
                invitation={invitation}
                premium={premium}
              />
            ) : null}
            {couture ? (
              <>
                <SignatureRsvpPreviewSection
                  design={design}
                  invitation={invitation}
                  packageCode="couture"
                  premium={premium}
                  rsvpSlot={rsvpSlot}
                  sectionNumber={14}
                  showOverlay
                />
                <CoutureGiftSection
                  design={design}
                  invitation={invitation}
                  onGiftEffect={(effectUrl) => {
                    void playEffect(effectUrl);
                  }}
                  premium={premium}
                />
              </>
            ) : null}
            <motion.section
              className={`${design.surface} relative grid min-h-[78svh] place-items-center overflow-hidden px-6 py-24 text-center`}
              data-essential-section={essential ? "7" : undefined}
              data-couture-section={couture ? "16" : undefined}
              data-signature-section={signature ? "13" : undefined}
              initial={reducedMotion ? false : { opacity: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              whileInView={{ opacity: 1 }}
            >
              <ThemeSectionDecoration
                config={premium}
                showOverlay={packageCode === "couture"}
              />
              <FadeText
                className={`relative z-30 max-w-4xl ${couture ? coutureStyles.readableText : ""}`}
                distance={24}
              >
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
              </FadeText>
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
