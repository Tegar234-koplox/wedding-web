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
  useReducedMotion,
} from "framer-motion";
import {
  CalendarDays,
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

const textFadeTransition = { duration: 0.85, ease: [0.22, 1, 0.36, 1] } as const;

const essentialSectionFourPhotos = [
  {
    alt: "Essential wedding portrait top composition",
    src: "/images/invitation-essential/section-4/top.png",
  },
  {
    alt: "Essential wedding portrait middle composition",
    src: "/images/invitation-essential/section-4/middle.png",
  },
  {
    alt: "Essential wedding portrait bottom composition",
    src: "/images/invitation-essential/section-4/bottom.png",
  },
] as const;

const essentialSectionSixPhotos = [
  {
    alt: "Essential wedding portrait top closing composition",
    src: "/images/invitation-essential/section-6/top.png",
  },
  {
    alt: "Essential wedding portrait bottom closing composition",
    src: "/images/invitation-essential/section-6/bottom.png",
  },
] as const;

const signatureSectionPhotos = {
  4: [
    {
      alt: "Signature wedding story photo top",
      src: "/images/invitation-signature/section-4/top.jpg",
    },
    {
      alt: "Signature wedding story photo middle",
      src: "/images/invitation-signature/section-4/middle.jpg",
    },
    {
      alt: "Signature wedding story photo bottom",
      src: "/images/invitation-signature/section-4/bottom.jpg",
    },
  ],
  6: [
    {
      alt: "Signature timeline photo top",
      src: "/images/invitation-signature/section-6/top.jpg",
    },
    {
      alt: "Signature timeline photo middle",
      src: "/images/invitation-signature/section-6/middle.jpg",
    },
    {
      alt: "Signature timeline photo bottom",
      src: "/images/invitation-signature/section-6/bottom.jpg",
    },
  ],
  8: [
    {
      alt: "Signature blessing photo top",
      src: "/images/invitation-signature/section-8/top.png",
    },
    {
      alt: "Signature blessing photo middle",
      src: "/images/invitation-signature/section-8/middle.png",
    },
    {
      alt: "Signature blessing photo bottom",
      src: "/images/invitation-signature/section-8/bottom.png",
    },
  ],
  10: [
    {
      alt: "Signature RSVP closing photo top",
      src: "/images/invitation-signature/section-10/top.png",
    },
    {
      alt: "Signature RSVP closing photo bottom",
      src: "/images/invitation-signature/section-10/bottom.png",
    },
  ],
} as const;

const coutureSectionPhotos = {
  4: [
    {
      alt: "Couture wedding story photo top",
      src: "/images/invitation-couture/photos/section-4/top.jpg",
    },
    {
      alt: "Couture wedding story photo middle",
      src: "/images/invitation-couture/photos/section-4/middle.jpg",
    },
    {
      alt: "Couture wedding story photo bottom",
      src: "/images/invitation-couture/photos/section-4/bottom.jpg",
    },
  ],
  6: [
    {
      alt: "Couture timeline photo top",
      src: "/images/invitation-couture/photos/section-6/top.jpg",
    },
    {
      alt: "Couture timeline photo middle",
      src: "/images/invitation-couture/photos/section-6/middle.jpg",
    },
    {
      alt: "Couture timeline photo bottom",
      src: "/images/invitation-couture/photos/section-6/bottom.jpg",
    },
  ],
  8: [
    {
      alt: "Couture intimacy photo top",
      src: "/images/invitation-couture/photos/section-8/top.png",
    },
    {
      alt: "Couture intimacy photo middle",
      src: "/images/invitation-couture/photos/section-8/middle.png",
    },
    {
      alt: "Couture intimacy photo bottom",
      src: "/images/invitation-couture/photos/section-8/bottom.png",
    },
  ],
  10: [
    {
      alt: "Couture trust photo top",
      src: "/images/invitation-couture/photos/section-10/top.png",
    },
    {
      alt: "Couture trust photo middle",
      src: "/images/invitation-couture/photos/section-10/middle.png",
    },
    {
      alt: "Couture trust photo bottom",
      src: "/images/invitation-couture/photos/section-10/bottom.png",
    },
  ],
  12: [
    {
      alt: "Couture final story photo top",
      src: "/images/invitation-couture/photos/section-12/top.png",
    },
    {
      alt: "Couture final story photo middle",
      src: "/images/invitation-couture/photos/section-12/middle.png",
    },
    {
      alt: "Couture final story photo bottom",
      src: "/images/invitation-couture/photos/section-12/bottom.png",
    },
  ],
} as const;

type GalleryPhoto = InvitationEnvelope["content"]["gallery"][number];

function sectionPhotosFromGallery(
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
  const guestName = invitation.guest?.displayName?.trim();
  const resolvedPackage = packageCode ?? "essential";
  const capability = packageCapabilities[resolvedPackage];
  const couture = resolvedPackage === "couture";
  const id = invitation.locale === "id";
  const essential = resolvedPackage === "essential";
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
              } ${
                design.coverLayout === "editorial" ? "" : "mx-auto"
              } ${
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
    <section className="relative overflow-hidden px-2 py-2">
      <div className="sr-only">{title}</div>
      <div
        className={`grid gap-2 ${
          variant === "three" ? "md:grid-cols-3" : "md:grid-cols-2"
        }`}
      >
        {photos.map((image, index) => (
          <motion.div
            className={`relative min-h-[56svh] overflow-hidden ${design.surface} ${
              variant === "three" && index === 1 ? "md:min-h-[68svh]" : ""
            }`}
            initial={{ opacity: 0, scale: 1.015 }}
            key={image.src}
            viewport={{ once: true, amount: 0.18 }}
            whileInView={{ opacity: 1, scale: 1 }}
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
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function EssentialGallerySection({
  design,
  gallery,
}: {
  design: ThemeVisual;
  gallery: InvitationEnvelope["content"]["gallery"];
}) {
  return (
    <section className="relative overflow-hidden px-2 py-2">
      <div className="grid gap-2 md:grid-cols-3">
        {gallery.slice(0, 3).map((image, index) => (
          <motion.div
            className={`relative min-h-[58svh] overflow-hidden ${design.surface} ${
              index === 1 ? "md:min-h-[70svh]" : ""
            }`}
            initial={{ opacity: 0, scale: 1.015 }}
            key={`${image.src}-${index}`}
            viewport={{ once: true, amount: 0.18 }}
            whileInView={{ opacity: 1, scale: 1 }}
          >
            <Image
              alt={image.alt}
              className="object-cover"
              fill
              sizes="(max-width: 767px) 100vw, 33vw"
              src={image.src}
            />
          </motion.div>
        ))}
      </div>
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
    >
      <FadeText className="mx-auto max-w-3xl">
        <p className={`text-[0.6rem] uppercase tracking-[0.25em] ${design.accent}`}>
          {id ? "Gift" : "Gift"}
        </p>
        <h2 className="mt-8 font-serif text-[clamp(3rem,8vw,7rem)] leading-[0.86] tracking-[-0.05em]">
          {id ? "Tanda kasih." : "A token of love."}
        </h2>
        <p className={`mx-auto mt-7 max-w-xl text-sm leading-7 ${design.muted}`}>
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
              <p className={`text-[0.58rem] uppercase tracking-[0.22em] ${design.accent}`}>
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

function SignaturePhotoSection({
  design,
  photos,
  premium,
  showOverlay = false,
  variant,
}: {
  design: ThemeVisual;
  photos: readonly { alt: string; src: string }[];
  premium: PremiumVisualConfig;
  showOverlay?: boolean;
  variant: "three" | "two";
}) {
  return (
    <section className={`${design.page} relative overflow-hidden px-2 py-2`}>
      <ThemeSectionDecoration config={premium} showOverlay={showOverlay} />
      <div
        className={`relative z-10 grid gap-2 ${
          variant === "three" ? "md:grid-cols-3" : "md:grid-cols-2"
        }`}
      >
        {photos.map((image, index) => (
          <motion.div
            className={`relative min-h-[58svh] overflow-hidden ${design.surface} ${
              variant === "three" && index === 1 ? "md:min-h-[70svh]" : ""
            }`}
            initial={{ opacity: 0, scale: 1.015 }}
            key={image.src}
            viewport={{ once: true, amount: 0.18 }}
            whileInView={{ opacity: 1, scale: 1 }}
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
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function SignatureGallerySection({
  design,
  gallery,
  premium,
  showOverlay = false,
}: {
  design: ThemeVisual;
  gallery: InvitationEnvelope["content"]["gallery"];
  premium: PremiumVisualConfig;
  showOverlay?: boolean;
}) {
  return (
    <section className={`${design.page} relative overflow-hidden px-2 py-2`}>
      <ThemeSectionDecoration config={premium} showOverlay={showOverlay} />
      <div className="relative z-10 grid gap-2 md:grid-cols-3">
        {gallery.slice(0, 3).map((image, index) => (
          <motion.div
            className={`relative min-h-[58svh] overflow-hidden ${design.surface} ${
              index === 1 ? "md:min-h-[70svh]" : ""
            }`}
            initial={{ opacity: 0, scale: 1.015 }}
            key={`${image.src}-${index}`}
            viewport={{ once: true, amount: 0.18 }}
            whileInView={{ opacity: 1, scale: 1 }}
          >
            <Image
              alt={image.alt}
              className="object-cover"
              fill
              sizes="(max-width: 767px) 100vw, 33vw"
              src={image.src}
            />
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function getTimelineEntries(
  invitation: InvitationEnvelope,
  mode: "opening" | "middle" | "final",
) {
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
        ["01", "Bertemu", "Sebuah awal yang sederhana membuka ruang untuk saling mengenal."],
        ["02", "Bertumbuh", "Cerita itu tumbuh melalui waktu, jarak, dan pilihan untuk tetap bersama."],
        ["03", "Suka Cita", "Rasa bahagia dan damai selalu tumbuh setiap hari membawa kesuburan."],
      ]
    : [
        ["01", "Meeting", "A simple beginning opened the way for two lives to know one another."],
        ["02", "Growing", "The story grew through time, distance, and the choice to keep returning."],
        ["03", "Joy", "Happiness and peace keep growing each day, bringing life into bloom."],
      ];
}

function getCoutureTimelineEntries(
  invitation: InvitationEnvelope,
  mode: "opening" | "conflict" | "intimacy" | "trust" | "final",
): TimelineEntries {
  const id = invitation.locale === "id";
  const entries = {
    opening: id
      ? [
          ["01", "Bertemu", "Sebuah awal yang sederhana yang membuka ruang untuk saling mengenal."],
          ["02", "Bertumbuh", "Cerita itu tumbuh melalui waktu, jarak, dan pilihan untuk tetap bersama."],
          ["03", "Suka Cita", "Rasa bahagia dan damai selalu tumbuh setiap hari membawa kesuburan."],
        ]
      : [
          ["01", "Meeting", "A simple beginning opened space for us to know one another."],
          ["02", "Growing", "The story grew through time, distance, and the choice to stay together."],
          ["03", "Joy", "Happiness and peace keep growing each day, bringing life into bloom."],
        ],
    conflict: id
      ? [
          ["04", "Tragedi Lembut", "Konflik yang turut mewarnai perjalanan dengan kontrol hati yang terarah."],
          ["05", "Sadar", "Ego tidak bisa melawan ego, masing-masing kami adalah rumah."],
          ["06", "Sabar", "Besar kecilnya masalah akan tetap kalah dengan tekad dan keteguhan hati yang selalu ingin bersama."],
        ]
      : [
          ["04", "A Gentle Tragedy", "Conflict colored the journey, guided by hearts learning direction."],
          ["05", "Awake", "Ego cannot defeat ego; each of us learned that the other is home."],
          ["06", "Patient", "Every problem, big or small, bows to the resolve and steadfastness that keep choosing togetherness."],
        ],
    intimacy: id
      ? [
          ["07", "Teliti", "Memperhatikan dan mengapresiasi hal-hal kecil untuk menjaga keintiman tetap hangat."],
          ["08", "Konsisten", "Naik turunnya rasa adalah hal rumit bagi kami, namun kemauan kami jauh lebih besar."],
          ["09", "Merajut", "Tetap saling melengkapi disaat hal-hal yang belum diketahui mulai terlihat sedikit demi sedikit."],
        ]
      : [
          ["07", "Attentive", "Noticing and appreciating small things keeps intimacy warm."],
          ["08", "Consistent", "The rise and fall of feelings can be complicated, yet our willingness is far greater."],
          ["09", "Weaving", "We keep completing one another as the unknown slowly begins to reveal itself."],
        ],
    trust: id
      ? [
          ["10", "Percaya", "Sedikit kecurigaan, lebih besar kepercayaan yang pada akhirnya saling mengikat."],
          ["11", "Memberi", "Bukan tentang materi, tapi sesuatu yang lebih berarti, tatapan yang jujur misalnya."],
          ["12", "Menguatkan", "Saling mendorong untuk meningkatkan nilai yang luhur dan mencapai hal-hal kecil untuk menunjang hal yang lebih besar. Salah satunya adalah kisah ini."],
        ]
      : [
          ["10", "Trust", "A little suspicion, but far greater trust, ultimately binding us together."],
          ["11", "Giving", "Not about material things, but something more meaningful, an honest gaze for example."],
          ["12", "Strengthening", "Encouraging one another to grow in noble value and accomplish small things that support something greater. One of them is this story."],
        ],
    final: id
      ? [
          ["11", "Mendengar", "Sebuah validasi yang berarti sebagai langkah awal untuk menumbuhkan rasa setiap hari."],
          ["12", "Maaf", "Bukan siapa yang paling salah, tapi siapa yang paling cinta, dan kami melakukannya."],
          ["13", "Hari Ini", "Kini perjalanan itu menuju hari yang kami rayakan bersama orang-orang terdekat."],
        ]
      : [
          ["11", "Listening", "A meaningful validation became the first step in growing love each day."],
          ["12", "Forgiveness", "It was never about who was most wrong, but who loved most, and we chose to do it."],
          ["13", "Today", "That journey now becomes a celebration shared with the people closest to us."],
        ],
  } satisfies Record<
    "opening" | "conflict" | "intimacy" | "trust" | "final",
    TimelineEntries
  >;

  return entries[mode];
}

function SignatureStoryTimelineSection({
  design,
  includeIntro,
  includeQuote,
  invitation,
  mode,
  premium,
  showOverlay = false,
  timeline,
}: {
  design: ThemeVisual;
  includeIntro: boolean;
  includeQuote: boolean;
  invitation: InvitationEnvelope;
  mode: "opening" | "middle" | "final";
  premium: PremiumVisualConfig;
  showOverlay?: boolean;
  timeline?: TimelineEntries;
}) {
  const { couple, quote, story } = invitation.content;
  const id = invitation.locale === "id";
  const timelineEntries = timeline ?? getTimelineEntries(invitation, mode);
  const copy =
    mode === "middle"
      ? id
        ? "Dari percakapan kecil, kami belajar merawat arah yang sama. Setiap musim membuat cerita ini semakin tenang dan utuh."
        : "From small conversations, we learned to care for the same direction. Every season made the story steadier and whole."
      : mode === "final"
        ? id
          ? "Kami membawa cerita ini ke hadapan keluarga dan sahabat, dengan rasa syukur atas perjalanan yang membentuk kami."
          : "We bring this story before family and friends, grateful for every step that shaped us."
        : story.body;

  return (
    <section className="relative overflow-hidden px-6 py-24 md:px-12 md:py-36">
      <ThemeSectionDecoration config={premium} showOverlay={showOverlay} />
      <div
        className={`relative z-30 mx-auto grid max-w-6xl gap-14 ${
          includeIntro ? "lg:grid-cols-[0.85fr_1.15fr]" : ""
        }`}
      >
        {includeIntro ? (
          <motion.div
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
          <p className={`text-lg leading-9 ${design.muted}`}>{copy}</p>
          <div className="mt-12 grid gap-px bg-current/15 md:grid-cols-3">
            {timelineEntries.map(([number, title, description]) => (
              <div className={`${design.surface} p-6`} key={number}>
                <p className={`text-[0.58rem] uppercase tracking-[0.2em] ${design.accent}`}>
                  {number}
                </p>
                <h3 className="mt-5 font-serif text-2xl">{title}</h3>
                <p className={`mt-4 text-sm leading-7 ${design.muted}`}>
                  {description}
                </p>
              </div>
            ))}
          </div>

          {includeQuote ? (
            <blockquote className={`mt-14 border-l pl-7 ${design.border}`}>
              <p className="font-serif text-2xl italic leading-9">
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
  premium,
  rsvpSlot,
  showOverlay = false,
}: {
  design: ThemeVisual;
  invitation: InvitationEnvelope;
  premium: PremiumVisualConfig;
  rsvpSlot?: React.ReactNode;
  showOverlay?: boolean;
}) {
  const id = invitation.locale === "id";

  if (rsvpSlot) {
    return (
      <section className={`${design.surface} relative overflow-hidden px-5 py-20 md:px-12 md:py-32`}>
        <ThemeSectionDecoration config={premium} showOverlay={showOverlay} />
        <div className="relative z-30">{rsvpSlot}</div>
      </section>
    );
  }

  return (
    <section className={`${design.surface} relative overflow-hidden px-6 py-24 md:px-12 md:py-36`}>
      <ThemeSectionDecoration config={premium} showOverlay={showOverlay} />
      <div className="relative z-30 mx-auto grid max-w-4xl gap-7 border border-current/20 p-6 md:p-10">
        <div>
          <p className={`text-[0.6rem] uppercase tracking-[0.25em] ${design.accent}`}>
            RSVP
          </p>
          <h2 className="mt-4 font-serif text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.9] tracking-[-0.04em]">
            {id ? "Konfirmasi kehadiran." : "Confirm your attendance."}
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className={`border px-4 py-3 text-sm ${design.border}`}>{id ? "Hadir" : "Attending"}</div>
          <div className={`border px-4 py-3 text-sm ${design.border}`}>1</div>
          <div className={`min-h-28 border px-4 py-3 text-sm ${design.border} md:col-span-2`}>
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
      </div>
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
  const folder = signatureGiftFolders[invitation.rendererKey];

  return (
    <section
      className={`${design.surface} relative grid min-h-[78svh] place-items-center overflow-hidden px-6 py-24 text-center md:px-12`}
    >
      <ThemeSectionDecoration config={premium} showOverlay={false} />
      <FadeText className="relative z-30 mx-auto max-w-3xl">
        <p className={`text-[0.6rem] uppercase tracking-[0.25em] ${design.accent}`}>
          {id ? "Gift" : "Gift"}
        </p>
        <h2 className="mt-8 font-serif text-[clamp(3rem,8vw,7rem)] leading-[0.86] tracking-[-0.05em]">
          {id ? "Tanda kasih." : "A token of love."}
        </h2>
        <p className={`mx-auto mt-7 max-w-xl text-sm leading-7 ${design.muted}`}>
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
              <p className={`text-[0.58rem] uppercase tracking-[0.22em] ${design.accent}`}>
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
  const folder = signatureGiftFolders[invitation.rendererKey];
  const effectUrl = coutureGiftSoundEffects[invitation.rendererKey];

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
    >
      <ThemeSectionDecoration config={premium} showOverlay />
      <FadeText className="relative z-30 mx-auto max-w-3xl">
        <p className={`text-[0.6rem] uppercase tracking-[0.25em] ${design.accent}`}>
          {id ? "Gift" : "Gift"}
        </p>
        <h2 className="mt-8 font-serif text-[clamp(3rem,8vw,7rem)] leading-[0.86] tracking-[-0.05em]">
          {id ? "Tanda kasih." : "A token of love."}
        </h2>
        <p className={`mx-auto mt-7 max-w-xl text-sm leading-7 ${design.muted}`}>
          {id
            ? "Doa dan kehadiran Anda adalah hadiah utama. Jika ingin menitipkan tanda kasih, detail rekening tersedia di bawah ini."
            : "Your prayers and presence are the greatest gift. If you would like to send a token of love, the account detail is available below."}
        </p>
      </FadeText>

      <div className="relative z-30 mt-12 flex flex-col items-center">
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

        <AnimatePresence>
          {opened ? (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className={`mt-8 min-w-64 border px-7 py-5 ${design.border}`}
              exit={{ opacity: 0, y: 10 }}
              initial={{ opacity: 0, y: 14 }}
              transition={textFadeTransition}
            >
              <p className={`text-[0.58rem] uppercase tracking-[0.22em] ${design.accent}`}>
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

function EventStory({
  invitation,
  packageCode,
  design,
  premium,
  rsvpSlot,
}: {
  invitation: InvitationEnvelope;
  packageCode: PackageCode;
  design: ThemeVisual;
  premium: PremiumVisualConfig;
  rsvpSlot?: React.ReactNode;
}) {
  const { event, story, quote, gallery } = invitation.content;
  const id = invitation.locale === "id";
  const capability = packageCapabilities[packageCode];
  const revealDistance = capability.motion === "refined" ? 46 : 28;

  if (packageCode === "signature") {
    return (
      <>
        <motion.section
          className={`${design.surface} relative overflow-hidden px-6 py-24 md:px-12 md:py-36`}
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
              ].map(({ label, value, Icon }, index) => (
                <FadeText
                  className={`${design.surface} p-7`}
                  delay={index * 0.08}
                  key={label}
                >
                  <Icon size={19} />
                  <p className="mt-9 text-[0.6rem] uppercase tracking-[0.18em] opacity-55">
                    {label}
                  </p>
                  <p className="mt-3 font-serif text-2xl leading-8">{value}</p>
                </FadeText>
              ))}
            </div>
            <FadeText delay={0.18}>
              <a
                className={`mx-auto mt-9 flex w-fit items-center gap-2 border-b pb-1 text-[0.62rem] uppercase tracking-[0.18em] ${design.border}`}
                href={event.mapUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <MapPin size={14} />
                {id ? "Buka peta" : "Open map"}
              </a>
            </FadeText>
          </div>
        </motion.section>

        <SignatureGallerySection
          design={design}
          gallery={gallery}
          premium={premium}
        />
        <SignatureStoryTimelineSection
          design={design}
          includeIntro
          includeQuote={false}
          invitation={invitation}
          mode="opening"
          premium={premium}
        />
        <SignaturePhotoSection
          design={design}
          photos={sectionPhotosFromGallery(gallery, 3, 3, signatureSectionPhotos[4])}
          premium={premium}
          variant="three"
        />
        <SignatureStoryTimelineSection
          design={design}
          includeIntro={false}
          includeQuote={false}
          invitation={invitation}
          mode="middle"
          premium={premium}
        />
        <SignaturePhotoSection
          design={design}
          photos={sectionPhotosFromGallery(gallery, 6, 3, signatureSectionPhotos[6])}
          premium={premium}
          variant="three"
        />
        <SignatureStoryTimelineSection
          design={design}
          includeIntro={false}
          includeQuote
          invitation={invitation}
          mode="final"
          premium={premium}
        />
        <SignaturePhotoSection
          design={design}
          photos={sectionPhotosFromGallery(gallery, 9, 3, signatureSectionPhotos[8])}
          premium={premium}
          variant="three"
        />
        <SignatureRsvpPreviewSection
          design={design}
          invitation={invitation}
          premium={premium}
          rsvpSlot={rsvpSlot}
        />
        <SignaturePhotoSection
          design={design}
          photos={sectionPhotosFromGallery(gallery, 12, 2, signatureSectionPhotos[10])}
          premium={premium}
          variant="two"
        />
      </>
    );
  }

  if (packageCode === "couture") {
    return (
      <>
        <motion.section
          className={`${design.surface} relative overflow-hidden px-6 py-24 md:px-12 md:py-36`}
          initial={{ opacity: 0, y: revealDistance }}
          transition={{ duration: 0.85 }}
          viewport={{ once: true, amount: 0.18 }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <ThemeSectionDecoration config={premium} showOverlay />
          <div className="relative z-30 mx-auto max-w-6xl">
            <FadeText className="text-center">
              <p className="text-[0.6rem] uppercase tracking-[0.25em] opacity-55">
                {id ? "Waktu & Tempat" : "Time & Place"}
              </p>
              <h2 className="mx-auto mt-7 max-w-4xl font-serif text-[clamp(3rem,8vw,7rem)] leading-[0.86] tracking-[-0.05em]">
                {event.dateLabel}
              </h2>
            </FadeText>
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
              ].map(({ label, value, Icon }, index) => (
                <FadeText
                  className={`${design.surface} p-7`}
                  delay={index * 0.08}
                  key={label}
                >
                  <Icon size={19} />
                  <p className="mt-9 text-[0.6rem] uppercase tracking-[0.18em] opacity-55">
                    {label}
                  </p>
                  <p className="mt-3 font-serif text-2xl leading-8">{value}</p>
                </FadeText>
              ))}
            </div>
            <FadeText delay={0.18}>
              <a
                className={`mx-auto mt-9 flex w-fit items-center gap-2 border-b pb-1 text-[0.62rem] uppercase tracking-[0.18em] ${design.border}`}
                href={event.mapUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <MapPin size={14} />
                {id ? "Buka peta" : "Open map"}
              </a>
            </FadeText>
          </div>
        </motion.section>

        <SignatureGallerySection
          design={design}
          gallery={gallery}
          premium={premium}
          showOverlay
        />
        <SignatureStoryTimelineSection
          design={design}
          includeIntro
          includeQuote={false}
          invitation={invitation}
          mode="opening"
          premium={premium}
          showOverlay
          timeline={getCoutureTimelineEntries(invitation, "opening")}
        />
        <SignaturePhotoSection
          design={design}
          photos={sectionPhotosFromGallery(gallery, 3, 3, coutureSectionPhotos[4])}
          premium={premium}
          showOverlay
          variant="three"
        />
        <SignatureStoryTimelineSection
          design={design}
          includeIntro={false}
          includeQuote={false}
          invitation={invitation}
          mode="middle"
          premium={premium}
          showOverlay
          timeline={getCoutureTimelineEntries(invitation, "conflict")}
        />
        <SignaturePhotoSection
          design={design}
          photos={sectionPhotosFromGallery(gallery, 6, 3, coutureSectionPhotos[6])}
          premium={premium}
          showOverlay
          variant="three"
        />
        <SignatureStoryTimelineSection
          design={design}
          includeIntro={false}
          includeQuote={false}
          invitation={invitation}
          mode="middle"
          premium={premium}
          showOverlay
          timeline={getCoutureTimelineEntries(invitation, "intimacy")}
        />
        <SignaturePhotoSection
          design={design}
          photos={sectionPhotosFromGallery(gallery, 9, 3, coutureSectionPhotos[8])}
          premium={premium}
          showOverlay
          variant="three"
        />
        <SignatureStoryTimelineSection
          design={design}
          includeIntro={false}
          includeQuote={false}
          invitation={invitation}
          mode="middle"
          premium={premium}
          showOverlay
          timeline={getCoutureTimelineEntries(invitation, "trust")}
        />
        <SignaturePhotoSection
          design={design}
          photos={sectionPhotosFromGallery(gallery, 12, 3, coutureSectionPhotos[10])}
          premium={premium}
          showOverlay
          variant="three"
        />
        <SignatureStoryTimelineSection
          design={design}
          includeIntro={false}
          includeQuote
          invitation={invitation}
          mode="final"
          premium={premium}
          showOverlay
          timeline={getCoutureTimelineEntries(invitation, "final")}
        />
        <SignaturePhotoSection
          design={design}
          photos={sectionPhotosFromGallery(gallery, 15, 3, coutureSectionPhotos[12])}
          premium={premium}
          showOverlay
          variant="three"
        />
      </>
    );
  }

  if (packageCode === "essential") {
    return (
      <>
        <motion.section
          className={`${design.surface} relative overflow-hidden px-6 py-24 md:px-12 md:py-36`}
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
              ].map(({ label, value, Icon }, index) => (
                <FadeText
                  className={`${design.surface} p-7`}
                  delay={index * 0.08}
                  key={label}
                >
                  <Icon size={19} />
                  <p className="mt-9 text-[0.6rem] uppercase tracking-[0.18em] opacity-55">
                    {label}
                  </p>
                  <p className="mt-3 font-serif text-2xl leading-8">{value}</p>
                </FadeText>
              ))}
            </div>
            <FadeText delay={0.18}>
              <a
                className={`mx-auto mt-9 flex w-fit items-center gap-2 border-b pb-1 text-[0.62rem] uppercase tracking-[0.18em] ${design.border}`}
                href={event.mapUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <MapPin size={14} />
                {id ? "Buka peta" : "Open map"}
              </a>
            </FadeText>
          </div>
        </motion.section>

        <EssentialGallerySection design={design} gallery={gallery} />

        <section className="relative overflow-hidden px-6 py-24 md:px-12 md:py-36">
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
                <p className="font-serif text-2xl italic leading-9">
                  &quot;{quote.text}&quot;
                </p>
                <footer className="mt-5 text-[0.6rem] uppercase tracking-[0.2em] opacity-55">
                  {quote.attribution}
                </footer>
              </blockquote>
            </motion.div>
          </div>
        </section>

        <EssentialPhotoSection
          design={design}
          photos={sectionPhotosFromGallery(gallery, 3, 3, essentialSectionFourPhotos)}
          title={id ? "Galeri lanjutan" : "Additional gallery"}
          variant="three"
        />
        <EssentialGiftSection design={design} invitation={invitation} />
        <EssentialPhotoSection
          design={design}
          photos={sectionPhotosFromGallery(gallery, 6, 2, essentialSectionSixPhotos)}
          title={id ? "Galeri penutup" : "Closing gallery"}
          variant="two"
        />
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
            ].map(({ label, value, Icon }, index) => (
              <FadeText
                className={`${design.surface} p-7`}
                delay={index * 0.08}
                key={label}
              >
                <Icon size={19} />
                <p className="mt-9 text-[0.6rem] uppercase tracking-[0.18em] opacity-55">
                  {label}
                </p>
                <p className="mt-3 font-serif text-2xl leading-8">{value}</p>
              </FadeText>
            ))}
          </div>
          <FadeText delay={0.18}>
            <a
              className={`mx-auto mt-9 flex w-fit items-center gap-2 border-b pb-1 text-[0.62rem] uppercase tracking-[0.18em] ${design.border}`}
              href={event.mapUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              <MapPin size={14} />
              {id ? "Buka peta" : "Open map"}
            </a>
          </FadeText>
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
              <p className="font-serif text-2xl italic leading-9">
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
  rsvpSlot,
  weather,
}: RendererV2Props) {
  const design = themeVisualConfig[invitation.rendererKey];
  const premium = getPremiumVisualConfig(invitation.rendererKey, packageCode);
  const reducedMotion = useReducedMotion();
  const [opened, setOpened] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { closing, couple } = invitation.content;
  const essential = packageCode === "essential";
  const signature = packageCode === "signature";
  const couture = packageCode === "couture";

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

  async function playGiftEffect(effectUrl: string) {
    const backgroundAudio = audioRef.current;
    const previousVolume = backgroundAudio?.volume ?? audio?.default_volume ?? 0.55;

    if (backgroundAudio) {
      backgroundAudio.volume = Math.max(0.08, previousVolume * 0.28);
    }

    const effect = new Audio(effectUrl);
    effect.volume = 0.9;

    const restoreVolume = () => {
      if (backgroundAudio) {
        backgroundAudio.volume = previousVolume;
      }
      effect.removeEventListener("ended", restoreVolume);
      effect.removeEventListener("error", restoreVolume);
    };

    effect.addEventListener("ended", restoreVolume);
    effect.addEventListener("error", restoreVolume);

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
              rsvpSlot={rsvpSlot}
            />
            {!essential ? (
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
                  premium={premium}
                  rsvpSlot={rsvpSlot}
                  showOverlay
                />
                <CoutureGiftSection
                  design={design}
                  invitation={invitation}
                  onGiftEffect={(effectUrl) => {
                    void playGiftEffect(effectUrl);
                  }}
                  premium={premium}
                />
              </>
            ) : null}
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
              <FadeText className="relative z-30 max-w-4xl" distance={24}>
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
