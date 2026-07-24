import {
  parseInvitationEnvelope,
  type InvitationContent,
  type InvitationEnvelope,
  type InvitationLocale,
  type PackageCode,
  type RendererKey,
} from "@wedding/invitation-themes";

type SampleIdentity = {
  partnerOne: string;
  partnerTwo: string;
  dateId: string;
  dateEn: string;
  venue: string;
  address: string;
  storyId: string;
  storyEn: string;
};

const identities: Record<RendererKey, SampleIdentity> = {
  "elegant-classic": {
    partnerOne: "Alya",
    partnerTwo: "Raka",
    dateId: "Sabtu, 12 September 2026",
    dateEn: "Saturday, 12 September 2026",
    venue: "The Langham Jakarta",
    address: "District 8, SCBD, Jakarta Selatan",
    storyId:
      "Kami bertemu di antara rak-rak buku dan percakapan yang seharusnya singkat. Lima tahun kemudian, kami masih memilih percakapan yang sama—kini untuk seumur hidup.",
    storyEn:
      "We met between bookshelves and a conversation meant to be brief. Five years later, we are still choosing that same conversation—now for a lifetime.",
  },
  "islamic-soft": {
    partnerOne: "Nadia",
    partnerTwo: "Fahri",
    dateId: "Ahad, 18 Oktober 2026",
    dateEn: "Sunday, 18 October 2026",
    venue: "Masjid Agung Al-Azhar",
    address: "Kebayoran Baru, Jakarta Selatan",
    storyId:
      "Dengan niat yang baik, doa kedua keluarga, dan hati yang dipertemukan pada waktu yang tepat, kami melangkah menuju ibadah terpanjang bersama.",
    storyEn:
      "With sincere intention, our families' prayers, and two hearts meeting at the right time, we begin our longest act of devotion together.",
  },
  "luxury-gold": {
    partnerOne: "Clarissa",
    partnerTwo: "Jonathan",
    dateId: "Sabtu, 7 November 2026",
    dateEn: "Saturday, 7 November 2026",
    venue: "The Apurva Kempinski Bali",
    address: "Nusa Dua, Bali",
    storyId:
      "Dari dua kota dan dua ritme hidup yang berbeda, kami menemukan rumah dalam keberanian satu sama lain. Malam ini, kisah itu menjadi perayaan.",
    storyEn:
      "From two cities and two different rhythms, we found home in each other's courage. Tonight, that story becomes a celebration.",
  },
  "minimalist-white": {
    partnerOne: "Tara",
    partnerTwo: "Dimas",
    dateId: "Minggu, 15 November 2026",
    dateEn: "Sunday, 15 November 2026",
    venue: "Plataran Cilandak",
    address: "Cilandak, Jakarta Selatan",
    storyId:
      "Tidak ada momen besar pada pertemuan pertama kami. Hanya rasa tenang, secangkir kopi, dan keyakinan kecil bahwa kami ingin bertemu lagi.",
    storyEn:
      "There was no grand moment when we first met. Only calm, a cup of coffee, and the quiet certainty that we wanted to meet again.",
  },
  "dark-cinematic": {
    partnerOne: "Keira",
    partnerTwo: "Arvin",
    dateId: "Sabtu, 21 November 2026",
    dateEn: "Saturday, 21 November 2026",
    venue: "The Tribrata Darmawangsa",
    address: "Kebayoran Baru, Jakarta Selatan",
    storyId:
      "Kisah kami tidak dimulai dengan sempurna. Ia tumbuh melalui jarak, keberanian, dan keputusan untuk terus kembali—sampai pulang berarti satu sama lain.",
    storyEn:
      "Our story did not begin perfectly. It grew through distance, courage, and the choice to keep returning—until home meant one another.",
  },
  "floral-romantic": {
    partnerOne: "Amara",
    partnerTwo: "Bima",
    dateId: "Sabtu, 5 Desember 2026",
    dateEn: "Saturday, 5 December 2026",
    venue: "Royal Ambarrukmo",
    address: "Sleman, Yogyakarta",
    storyId:
      "Sebuah pertemanan lama berubah perlahan menjadi tempat paling hangat. Kami bertumbuh, berpindah, dan akhirnya memilih mekar di musim yang sama.",
    storyEn:
      "An old friendship slowly became our warmest place. We grew, wandered, and finally chose to bloom in the same season.",
  },
  "javanese-traditional": {
    partnerOne: "Sekar",
    partnerTwo: "Bagas",
    dateId: "Minggu, 13 Desember 2026",
    dateEn: "Sunday, 13 December 2026",
    venue: "Pendopo Agung Royal Ambarrukmo",
    address: "Sleman, Daerah Istimewa Yogyakarta",
    storyId:
      "Dibesarkan oleh nilai yang sama, kami belajar bahwa cinta juga berarti ngugemi janji—merawat yang diwariskan sambil membangun rumah untuk masa depan.",
    storyEn:
      "Raised by shared values, we learned that love also means keeping a promise—honoring what came before while building a home for the future.",
  },
};

const galleryByTheme: Record<RendererKey, InvitationContent["gallery"]> = {
  "elegant-classic": [
    {
      src: "/images/hero-editorial.webp",
      alt: "Editorial portrait of the couple",
    },
    {
      src: "/images/themes/elegant-classic.webp",
      alt: "Classic invitation details",
    },
    {
      src: "/images/themes/minimalist-white.webp",
      alt: "White stationery detail",
    },
  ],
  "islamic-soft": [
    {
      src: "/images/themes/islamic-soft.webp",
      alt: "Islamic geometric stationery",
    },
    { src: "/images/hero-editorial.webp", alt: "Portrait of the couple" },
    { src: "/images/themes/minimalist-white.webp", alt: "Soft white detail" },
  ],
  "luxury-gold": [
    {
      src: "/images/themes/luxury-gold.webp",
      alt: "Black and gold stationery",
    },
    {
      src: "/images/hero-editorial.webp",
      alt: "Evening portrait of the couple",
    },
    { src: "/images/themes/dark-cinematic.webp", alt: "Dark floral detail" },
  ],
  "minimalist-white": [
    {
      src: "/images/themes/minimalist-white.webp",
      alt: "Minimal white stationery",
    },
    { src: "/images/hero-editorial.webp", alt: "Modern couple portrait" },
    {
      src: "/images/themes/elegant-classic.webp",
      alt: "Paper and ribbon detail",
    },
  ],
  "dark-cinematic": [
    {
      src: "/images/hero-editorial.webp",
      alt: "Cinematic portrait of the couple",
    },
    {
      src: "/images/themes/dark-cinematic.webp",
      alt: "Dark invitation detail",
    },
    { src: "/images/themes/luxury-gold.webp", alt: "Gold stationery detail" },
  ],
  "floral-romantic": [
    {
      src: "/images/themes/floral-romantic.webp",
      alt: "Romantic floral stationery",
    },
    { src: "/images/hero-editorial.webp", alt: "Portrait of the couple" },
    { src: "/images/themes/islamic-soft.webp", alt: "Jasmine and silk detail" },
  ],
  "javanese-traditional": [
    {
      src: "/images/themes/javanese-traditional.webp",
      alt: "Javanese craft details",
    },
    {
      src: "/images/hero-editorial.webp",
      alt: "Formal portrait of the couple",
    },
    { src: "/images/themes/luxury-gold.webp", alt: "Antique gold detail" },
  ],
};

const essentialGallery: InvitationContent["gallery"] = [
  {
    src: "/images/invitation-essential/section-2/groom.webp",
    alt: "Portrait of the groom",
  },
  {
    src: "/images/invitation-essential/section-2/bride.webp",
    alt: "Portrait of the bride",
  },
  ...Array.from({ length: 3 }, (_, index) => ({
    src: `/images/invitation-essential/section-4/section-4-0${index + 1}.webp`,
    alt: `Essential story portrait ${index + 1}`,
  })),
  ...Array.from({ length: 9 }, (_, index) => ({
    src: `/images/invitation-essential/section-6/gallery-${String(
      index + 1,
    ).padStart(2, "0")}.webp`,
    alt: `Essential gallery portrait ${index + 1}`,
  })),
];

function createContent(
  key: RendererKey,
  locale: InvitationLocale,
  packageCode?: PackageCode,
): InvitationContent {
  const identity = identities[key];
  const id = locale === "id";
  const names = `${identity.partnerOne} & ${identity.partnerTwo}`;

  return {
    couple: {
      partnerOne: identity.partnerOne,
      partnerOneDescription: id
        ? "Mempelai wanita, putri terkasih dari keluarga."
        : "The bride, a beloved daughter of the family.",
      partnerTwo: identity.partnerTwo,
      partnerTwoDescription: id
        ? "Mempelai pria, putra terkasih dari keluarga."
        : "The groom, a beloved son of the family.",
      monogram: `${identity.partnerOne[0]}&${identity.partnerTwo[0]}`,
    },
    opening: {
      eyebrow: id ? "Dengan penuh sukacita" : "Together with joyful hearts",
      title: id ? "Kami mengundang Anda" : "We invite you",
      message: id
        ? `Untuk hadir dan menjadi bagian dari hari pernikahan ${names}.`
        : `To witness and celebrate the wedding of ${names}.`,
    },
    event: {
      dateLabel: id ? "Akad dan Resepsi" : "Ceremony and Reception",
      ceremonyLabel: id ? "Akad Nikah" : "Wedding Ceremony",
      ceremonyTime: id
        ? `${identity.dateId}, 09.00 AM`
        : `${identity.dateEn}, 09.00 AM`,
      receptionLabel: id ? "Resepsi" : "Reception",
      receptionTime: id
        ? `${identity.dateId}, 11.00 AM`
        : `${identity.dateEn}, 11.00 AM`,
      venue: identity.venue,
      address: identity.address,
      mapUrl: "https://maps.google.com",
    },
    story: {
      heading: id ? "Tentang perjalanan kami" : "A little about us",
      body: id ? identity.storyId : identity.storyEn,
    },
    quote: {
      text: id
        ? "Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan pasangan-pasangan untukmu."
        : "And among His signs is that He created for you partners from among yourselves.",
      attribution: "Ar-Rum · 21",
    },
    gallery:
      packageCode === "essential" ? essentialGallery : galleryByTheme[key],
    closing: {
      heading: id ? "Sampai bertemu" : "We hope to see you",
      message: id
        ? "Kehadiran dan doa Anda adalah hadiah yang sangat berarti bagi perjalanan baru kami."
        : "Your presence and prayers would mean the world as we begin this new chapter.",
    },
  };
}

export function getSampleInvitation(
  key: RendererKey,
  locale: InvitationLocale,
  packageCode?: PackageCode,
): InvitationEnvelope {
  return parseInvitationEnvelope({
    rendererKey: key,
    rendererVersion: 2,
    contentSchemaVersion: 1,
    locale,
    content: createContent(key, locale, packageCode),
  });
}
