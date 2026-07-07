import type { RendererKey } from "@wedding/invitation-themes";

import type { Locale } from "@/lib/locales";

export type Theme = {
  slug: RendererKey;
  name: Record<Locale, string>;
  category: Record<Locale, string>;
  description: Record<Locale, string>;
  image: string;
  accent: string;
  tone: "dark" | "light";
};

export type ServicePackage = {
  code: string;
  name: string;
  price: string;
  featured?: boolean;
  description: Record<Locale, string>;
  features: Record<Locale, string[]>;
};

export const themes: Theme[] = [
  {
    slug: "elegant-classic",
    name: { id: "Elegant Classic", en: "Elegant Classic" },
    category: { id: "Klasik Modern", en: "Modern Classic" },
    description: {
      id: "Tipografi anggun, detail emboss, dan palet monokrom yang tak lekang waktu.",
      en: "Graceful typography, embossed details, and a timeless monochrome palette.",
    },
    image: "/images/themes/elegant-classic.webp",
    accent: "#d5ad55",
    tone: "dark",
  },
  {
    slug: "islamic-soft",
    name: { id: "Islamic Soft", en: "Islamic Soft" },
    category: { id: "Tenang & Sakral", en: "Serene & Sacred" },
    description: {
      id: "Geometri lembut, cahaya pagi, dan nuansa sakral yang terasa modern.",
      en: "Soft geometry, morning light, and a sacred atmosphere made modern.",
    },
    image: "/images/themes/islamic-soft.webp",
    accent: "#b8b8a3",
    tone: "light",
  },
  {
    slug: "luxury-gold",
    name: { id: "Luxury Gold", en: "Luxury Gold" },
    category: { id: "Mewah Terkurasi", en: "Curated Luxury" },
    description: {
      id: "Hitam pekat, emas antik, dan ritme visual yang terasa seperti perhiasan.",
      en: "Deep black, antique gold, and a visual rhythm that feels like jewelry.",
    },
    image: "/images/themes/luxury-gold.webp",
    accent: "#c89f4c",
    tone: "dark",
  },
  {
    slug: "minimalist-white",
    name: { id: "Minimalist White", en: "Minimalist White" },
    category: { id: "Hening Modern", en: "Modern Restraint" },
    description: {
      id: "Ruang putih, bayangan arsitektural, dan detail yang bicara pelan.",
      en: "White space, architectural shadows, and details that speak quietly.",
    },
    image: "/images/themes/minimalist-white.webp",
    accent: "#d7d2c8",
    tone: "light",
  },
  {
    slug: "dark-cinematic",
    name: { id: "Dark Cinematic", en: "Dark Cinematic" },
    category: { id: "Dramatis & Intim", en: "Dramatic & Intimate" },
    description: {
      id: "Bayangan dalam, merah oxblood, dan transisi seperti pembuka sebuah film.",
      en: "Deep shadow, oxblood red, and transitions that open like a film.",
    },
    image: "/images/themes/dark-cinematic.webp",
    accent: "#7b1d25",
    tone: "dark",
  },
  {
    slug: "floral-romantic",
    name: { id: "Floral Romantic", en: "Floral Romantic" },
    category: { id: "Botanikal Editorial", en: "Botanical Editorial" },
    description: {
      id: "Bunga taman yang liar namun terarah, lembut tanpa kehilangan karakter.",
      en: "Garden flowers, loose yet art-directed—soft without losing character.",
    },
    image: "/images/themes/floral-romantic.webp",
    accent: "#a46770",
    tone: "light",
  },
  {
    slug: "javanese-traditional",
    name: { id: "Javanese / Traditional", en: "Javanese / Traditional" },
    category: { id: "Warisan Kontemporer", en: "Contemporary Heritage" },
    description: {
      id: "Tekstur soga, ukiran, dan bahasa visual Jawa yang ditata secara kontemporer.",
      en: "Soga tones, carved details, and Javanese visual language reframed for today.",
    },
    image: "/images/themes/javanese-traditional.webp",
    accent: "#a77b43",
    tone: "dark",
  },
];

export const packages: ServicePackage[] = [
  {
    code: "essential",
    name: "Essential",
    price: "Rp 99k",
    description: {
      id: "Untuk pasangan yang membutuhkan undangan digital rapi dan personal.",
      en: "For couples who want a polished, personal digital invitation.",
    },
    features: {
      id: [
        "1 tema pilihan",
        "Informasi acara",
        "Galeri 8 foto",
        "Peta lokasi",
        "Gift",
        "Musik latar belakang",
        "Revisi 3 kali",
      ],
      en: [
        "1 selected theme",
        "Event information",
        "8-photo gallery",
        "Location map",
        "Gift",
        "Background music",
        "3 revisions",
      ],
    },
  },
  {
    code: "signature",
    name: "Signature",
    price: "Rp 249k",
    featured: true,
    description: {
      id: "Pengalaman lengkap dengan cerita, RSVP, dan sentuhan editorial.",
      en: "A complete experience with your story, RSVP, and editorial details.",
    },
    features: {
      id: [
        "Semua fitur Essential",
        "Love story & timeline",
        "RSVP dan ucapan",
        "Galeri +3 foto dari paket Essential",
        "Prakiraan cuaca di lokasi acara",
        "Revisi 5 kali",
      ],
      en: [
        "Everything in Essential",
        "Love story & timeline",
        "RSVP and wishes",
        "+3 photos from Essential package",
        "Weather forecast at event location",
        "5 revisions",
      ],
    },
  },
  {
    code: "couture",
    name: "Couture",
    price: "Rp 549k",
    description: {
      id: "Art direction khusus untuk perayaan yang ingin tampil benar-benar berbeda.",
      en: "Bespoke art direction for celebrations that need a singular presence.",
    },
    features: {
      id: [
        "Semua fitur Signature",
        "Art direction khusus",
        "Penyesuaian warna dan tipografi",
        "Motion sequence khusus",
        "Revisi 8 kali",
        "Galeri +4 foto dari paket Signature",
      ],
      en: [
        "Everything in Signature",
        "Bespoke art direction",
        "Custom color and typography",
        "Custom motion sequence",
        "8 revisions",
        "+4 photos from Signature package",
      ],
    },
  },
];

export function getTheme(slug: string): Theme | undefined {
  return themes.find((theme) => theme.slug === slug);
}
