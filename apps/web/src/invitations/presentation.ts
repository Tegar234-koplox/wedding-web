import {
  packageCapabilities,
  type PackageCode,
  type RendererKey,
} from "@wedding/invitation-themes";

export { packageCapabilities };
export type { PackageCode };

export type ThemeVisual = {
  key: RendererKey;
  page: string;
  surface: string;
  ink: string;
  muted: string;
  accent: string;
  border: string;
  coverImage: string;
  coverLayout: "split" | "arch" | "editorial" | "minimal";
  ornament:
    | "filigree"
    | "islamic"
    | "foil"
    | "minimal"
    | "cinematic"
    | "floral"
    | "batik";
  overlay: string;
  weather: string;
  glow: string;
};

export type OverlayAsset = {
  src: string;
  mode: "frame" | "motif";
  objectFit: "contain" | "cover";
  mobileBlend?: "side-pair";
  desktopInstances: 1 | 3;
  mobileInstances: 1 | 2;
  perimeterMask: boolean;
};

export type CornerAssets =
  | {
      mode: "frame";
      src: string;
      objectFit: "contain" | "fill";
      placement: "full-frame" | "quadrants";
    }
  | {
      mode: "individual";
      layout?: "corner" | "full-canvas";
      sources: {
        topLeft?: string;
        topRight?: string;
        bottomLeft?: string;
        bottomRight?: string;
      };
    };

export type PremiumVisualConfig = {
  overlay: OverlayAsset | null;
  corners: CornerAssets | null;
  coverAnimated: boolean;
  contentAnimated: boolean;
  textContrast: boolean;
  opacity: number;
};

const essentialVisual: PremiumVisualConfig = {
  overlay: null,
  corners: null,
  coverAnimated: false,
  contentAnimated: false,
  textContrast: false,
  opacity: 0,
};

function premiumVisual(
  values: Omit<PremiumVisualConfig, "coverAnimated" | "contentAnimated"> & {
    couture?: boolean;
  },
): PremiumVisualConfig {
  const { couture = false, ...config } = values;
  return {
    ...config,
    coverAnimated: true,
    contentAnimated: couture,
  };
}

export const themeVisualConfig: Record<RendererKey, ThemeVisual> = {
  "elegant-classic": {
    key: "elegant-classic",
    page: "bg-[#f1eadf] text-[#211d17]",
    surface: "bg-[#e8ddcc] text-[#211d17]",
    ink: "text-[#211d17]",
    muted: "text-[#746a5b]",
    accent: "text-[#9a7135]",
    border: "border-[#a9854c]/45",
    coverImage: "/images/themes/elegant-classic.webp",
    coverLayout: "split",
    ornament: "filigree",
    overlay:
      "bg-[radial-gradient(circle_at_28%_18%,rgba(218,183,112,.3),transparent_34%),linear-gradient(135deg,rgba(255,251,240,.72),rgba(202,177,132,.2))]",
    weather: "bg-[#f5efe4] border-[#a9854c]/55",
    glow: "shadow-[0_24px_90px_rgba(120,88,39,.16)]",
  },
  "islamic-soft": {
    key: "islamic-soft",
    page: "bg-[#edf0e7] text-[#263029]",
    surface: "bg-[#dce2d5] text-[#263029]",
    ink: "text-[#263029]",
    muted: "text-[#687369]",
    accent: "text-[#8f794b]",
    border: "border-[#8f794b]/35",
    coverImage: "/images/themes/islamic-soft.webp",
    coverLayout: "arch",
    ornament: "islamic",
    overlay:
      "bg-[radial-gradient(circle_at_50%_20%,rgba(226,213,158,.34),transparent_32%),linear-gradient(180deg,rgba(238,242,230,.58),rgba(156,174,150,.24))]",
    weather: "bg-[#e7ebdf] border-[#8f794b]/35",
    glow: "shadow-[0_24px_90px_rgba(65,81,64,.13)]",
  },
  "luxury-gold": {
    key: "luxury-gold",
    page: "bg-[#090806] text-[#ead9aa]",
    surface: "bg-[#15120d] text-[#ead9aa]",
    ink: "text-[#ead9aa]",
    muted: "text-[#a79b80]",
    accent: "text-[#d2ad55]",
    border: "border-[#d2ad55]/50",
    coverImage: "/images/themes/luxury-gold.webp",
    coverLayout: "split",
    ornament: "foil",
    overlay:
      "bg-[radial-gradient(circle_at_70%_15%,rgba(218,178,79,.22),transparent_28%),linear-gradient(125deg,rgba(0,0,0,.4),rgba(87,58,13,.26),rgba(0,0,0,.74))]",
    weather: "bg-[#12100c] border-[#d2ad55]/50",
    glow: "shadow-[0_24px_110px_rgba(204,157,62,.17)]",
  },
  "minimalist-white": {
    key: "minimalist-white",
    page: "bg-[#f7f6f2] text-[#171717]",
    surface: "bg-[#ecebe7] text-[#171717]",
    ink: "text-[#171717]",
    muted: "text-[#70706b]",
    accent: "text-[#343434]",
    border: "border-black/20",
    coverImage: "/images/themes/minimalist-white.webp",
    coverLayout: "minimal",
    ornament: "minimal",
    overlay:
      "bg-[linear-gradient(145deg,rgba(255,255,255,.72),rgba(221,220,214,.25))]",
    weather: "bg-white border-black/15",
    glow: "shadow-[0_24px_80px_rgba(0,0,0,.08)]",
  },
  "dark-cinematic": {
    key: "dark-cinematic",
    page: "bg-[#090808] text-[#eee8df]",
    surface: "bg-[#170b0c] text-[#eee8df]",
    ink: "text-[#eee8df]",
    muted: "text-[#aaa19a]",
    accent: "text-[#bd4851]",
    border: "border-[#a73a42]/55",
    coverImage: "/images/hero-editorial.webp",
    coverLayout: "editorial",
    ornament: "cinematic",
    overlay:
      "bg-[radial-gradient(circle_at_75%_30%,rgba(131,20,31,.4),transparent_34%),linear-gradient(120deg,rgba(0,0,0,.35),rgba(65,4,10,.4),rgba(0,0,0,.83))]",
    weather: "bg-[#120a0b] border-[#a73a42]/55",
    glow: "shadow-[0_24px_120px_rgba(126,19,29,.26)]",
  },
  "floral-romantic": {
    key: "floral-romantic",
    page: "bg-[#f0dfdc] text-[#4c3135]",
    surface: "bg-[#e4c7c4] text-[#4c3135]",
    ink: "text-[#4c3135]",
    muted: "text-[#7d5b60]",
    accent: "text-[#9a5964]",
    border: "border-[#a96f77]/40",
    coverImage: "/images/themes/floral-romantic.webp",
    coverLayout: "arch",
    ornament: "floral",
    overlay:
      "bg-[radial-gradient(circle_at_25%_15%,rgba(255,241,231,.62),transparent_33%),linear-gradient(140deg,rgba(247,220,215,.46),rgba(194,125,139,.2))]",
    weather: "bg-[#f5e6e1] border-[#a96f77]/40",
    glow: "shadow-[0_24px_90px_rgba(151,91,103,.15)]",
  },
  "javanese-traditional": {
    key: "javanese-traditional",
    page: "bg-[#251c14] text-[#ead9b7]",
    surface: "bg-[#342519] text-[#ead9b7]",
    ink: "text-[#ead9b7]",
    muted: "text-[#b8a98d]",
    accent: "text-[#d2aa6b]",
    border: "border-[#c99a58]/45",
    coverImage: "/images/themes/javanese-traditional.webp",
    coverLayout: "arch",
    ornament: "batik",
    overlay:
      "bg-[radial-gradient(circle_at_50%_15%,rgba(188,137,67,.25),transparent_30%),linear-gradient(145deg,rgba(69,43,22,.35),rgba(19,13,9,.78))]",
    weather: "bg-[#302218] border-[#c99a58]/45",
    glow: "shadow-[0_24px_100px_rgba(146,99,44,.17)]",
  },
};

export const premiumVisualConfig: Record<
  RendererKey,
  Record<PackageCode, PremiumVisualConfig>
> = {
  "elegant-classic": {
    essential: essentialVisual,
    signature: premiumVisual({
      overlay: {
        src: "/images/invitation-decorations/elegant-classic/ribbon-flow.svg",
        mode: "frame",
        objectFit: "cover",
        desktopInstances: 1,
        mobileInstances: 1,
        perimeterMask: true,
      },
      corners: {
        mode: "individual",
        sources: {
          topLeft:
            "/images/invitation-decorations/elegant-classic/corner-top-left.svg",
          topRight:
            "/images/invitation-decorations/elegant-classic/corner-top-right.svg",
          bottomLeft:
            "/images/invitation-decorations/elegant-classic/corner-bottom-left.svg",
          bottomRight:
            "/images/invitation-decorations/elegant-classic/corner-bottom-right.svg",
        },
      },
      textContrast: true,
      opacity: 0.7,
    }),
    couture: premiumVisual({
      overlay: {
        src: "/images/invitation-decorations/elegant-classic/ribbon-flow.svg",
        mode: "frame",
        objectFit: "cover",
        desktopInstances: 1,
        mobileInstances: 1,
        perimeterMask: true,
      },
      corners: {
        mode: "individual",
        sources: {
          topLeft:
            "/images/invitation-decorations/elegant-classic/corner-top-left.svg",
          topRight:
            "/images/invitation-decorations/elegant-classic/corner-top-right.svg",
          bottomLeft:
            "/images/invitation-decorations/elegant-classic/corner-bottom-left.svg",
          bottomRight:
            "/images/invitation-decorations/elegant-classic/corner-bottom-right.svg",
        },
      },
      textContrast: true,
      opacity: 0.7,
      couture: true,
    }),
  },
  "islamic-soft": {
    essential: essentialVisual,
    signature: premiumVisual({
      overlay: {
        src: "/images/invitation-decorations/islamic-soft/golden-brown-moon-stars-overlay.webp",
        mode: "frame",
        objectFit: "cover",
        desktopInstances: 1,
        mobileInstances: 1,
        perimeterMask: true,
      },
      corners: {
        mode: "individual",
        sources: {
          topLeft:
            "/images/invitation-decorations/islamic-soft/corner-top-left.webp",
          topRight:
            "/images/invitation-decorations/islamic-soft/corner-top-right.webp",
          bottomLeft:
            "/images/invitation-decorations/islamic-soft/corner-bottom-left.webp",
          bottomRight:
            "/images/invitation-decorations/islamic-soft/corner-bottom-right.webp",
        },
      },
      textContrast: true,
      opacity: 0.7,
    }),
    couture: premiumVisual({
      overlay: {
        src: "/images/invitation-decorations/islamic-soft/golden-brown-moon-stars-overlay.webp",
        mode: "frame",
        objectFit: "cover",
        desktopInstances: 1,
        mobileInstances: 1,
        perimeterMask: true,
      },
      corners: {
        mode: "individual",
        sources: {
          topLeft:
            "/images/invitation-decorations/islamic-soft/corner-top-left.webp",
          topRight:
            "/images/invitation-decorations/islamic-soft/corner-top-right.webp",
          bottomLeft:
            "/images/invitation-decorations/islamic-soft/corner-bottom-left.webp",
          bottomRight:
            "/images/invitation-decorations/islamic-soft/corner-bottom-right.webp",
        },
      },
      textContrast: true,
      opacity: 0.7,
      couture: true,
    }),
  },
  "luxury-gold": {
    essential: essentialVisual,
    signature: premiumVisual({
      overlay: {
        src: "/images/invitation-decorations/luxury-gold/overlay.webp",
        mode: "frame",
        objectFit: "cover",
        desktopInstances: 1,
        mobileInstances: 1,
        perimeterMask: true,
      },
      corners: {
        mode: "individual",
        sources: {
          topLeft:
            "/images/invitation-decorations/luxury-gold/corner-top-left.svg",
          topRight:
            "/images/invitation-decorations/luxury-gold/corner-top-right.svg",
          bottomLeft:
            "/images/invitation-decorations/luxury-gold/corner-bottom-left.svg",
          bottomRight:
            "/images/invitation-decorations/luxury-gold/corner-bottom-right.svg",
        },
      },
      textContrast: false,
      opacity: 0.7,
    }),
    couture: premiumVisual({
      overlay: {
        src: "/images/invitation-decorations/luxury-gold/overlay.webp",
        mode: "frame",
        objectFit: "cover",
        desktopInstances: 1,
        mobileInstances: 1,
        perimeterMask: true,
      },
      corners: {
        mode: "individual",
        sources: {
          topLeft:
            "/images/invitation-decorations/luxury-gold/corner-top-left.svg",
          topRight:
            "/images/invitation-decorations/luxury-gold/corner-top-right.svg",
          bottomLeft:
            "/images/invitation-decorations/luxury-gold/corner-bottom-left.svg",
          bottomRight:
            "/images/invitation-decorations/luxury-gold/corner-bottom-right.svg",
        },
      },
      textContrast: false,
      opacity: 0.7,
      couture: true,
    }),
  },
  "minimalist-white": {
    essential: essentialVisual,
    signature: premiumVisual({
      overlay: {
        src: "/images/invitation-decorations/minimalist-white/minimalist-white-real-cloud-overlay.webp",
        mode: "frame",
        objectFit: "cover",
        desktopInstances: 1,
        mobileInstances: 1,
        perimeterMask: true,
      },
      corners: {
        mode: "individual",
        layout: "corner",
        sources: {
          topLeft:
            "/images/invitation-decorations/minimalist-white/corner-top-left.webp",
          topRight:
            "/images/invitation-decorations/minimalist-white/corner-top-right.webp",
          bottomLeft:
            "/images/invitation-decorations/minimalist-white/corner-bottom-left.webp",
          bottomRight:
            "/images/invitation-decorations/minimalist-white/corner-bottom-right.webp",
        },
      },
      textContrast: false,
      opacity: 0.7,
    }),
    couture: premiumVisual({
      overlay: {
        src: "/images/invitation-decorations/minimalist-white/minimalist-white-real-cloud-overlay.webp",
        mode: "frame",
        objectFit: "cover",
        desktopInstances: 1,
        mobileInstances: 1,
        perimeterMask: true,
      },
      corners: {
        mode: "individual",
        layout: "corner",
        sources: {
          topLeft:
            "/images/invitation-decorations/minimalist-white/corner-top-left.webp",
          topRight:
            "/images/invitation-decorations/minimalist-white/corner-top-right.webp",
          bottomLeft:
            "/images/invitation-decorations/minimalist-white/corner-bottom-left.webp",
          bottomRight:
            "/images/invitation-decorations/minimalist-white/corner-bottom-right.webp",
        },
      },
      textContrast: false,
      opacity: 0.7,
      couture: true,
    }),
  },
  "dark-cinematic": {
    essential: essentialVisual,
    signature: premiumVisual({
      overlay: {
        src: "/images/invitation-decorations/dark-cinematic/dark-cinematic-red-rose-petals-overlay.webp",
        mode: "frame",
        objectFit: "cover",
        desktopInstances: 1,
        mobileInstances: 1,
        perimeterMask: true,
      },
      corners: {
        mode: "individual",
        layout: "corner",
        sources: {
          topLeft:
            "/images/invitation-decorations/dark-cinematic/corner-top-left.webp",
          topRight:
            "/images/invitation-decorations/dark-cinematic/corner-top-right.webp",
          bottomLeft:
            "/images/invitation-decorations/dark-cinematic/corner-bottom-left.webp",
          bottomRight:
            "/images/invitation-decorations/dark-cinematic/corner-bottom-right.webp",
        },
      },
      textContrast: false,
      opacity: 0.7,
    }),
    couture: premiumVisual({
      overlay: {
        src: "/images/invitation-decorations/dark-cinematic/dark-cinematic-red-rose-petals-overlay.webp",
        mode: "frame",
        objectFit: "cover",
        desktopInstances: 1,
        mobileInstances: 1,
        perimeterMask: true,
      },
      corners: {
        mode: "individual",
        layout: "corner",
        sources: {
          topLeft:
            "/images/invitation-decorations/dark-cinematic/corner-top-left.webp",
          topRight:
            "/images/invitation-decorations/dark-cinematic/corner-top-right.webp",
          bottomLeft:
            "/images/invitation-decorations/dark-cinematic/corner-bottom-left.webp",
          bottomRight:
            "/images/invitation-decorations/dark-cinematic/corner-bottom-right.webp",
        },
      },
      textContrast: false,
      opacity: 0.7,
      couture: true,
    }),
  },
  "floral-romantic": {
    essential: essentialVisual,
    signature: premiumVisual({
      overlay: {
        src: "/images/invitation-decorations/floral-romantic/floral-romantic-light-blue-petals-overlay.webp",
        mode: "frame",
        objectFit: "cover",
        desktopInstances: 1,
        mobileInstances: 1,
        perimeterMask: true,
      },
      corners: {
        mode: "individual",
        layout: "corner",
        sources: {
          topLeft:
            "/images/invitation-decorations/floral-romantic/corner-top-left.webp",
          topRight:
            "/images/invitation-decorations/floral-romantic/corner-top-right.webp",
          bottomLeft:
            "/images/invitation-decorations/floral-romantic/corner-bottom-left.webp",
          bottomRight:
            "/images/invitation-decorations/floral-romantic/corner-bottom-right.webp",
        },
      },
      textContrast: true,
      opacity: 0.7,
    }),
    couture: premiumVisual({
      overlay: {
        src: "/images/invitation-decorations/floral-romantic/floral-romantic-light-blue-petals-overlay.webp",
        mode: "frame",
        objectFit: "cover",
        desktopInstances: 1,
        mobileInstances: 1,
        perimeterMask: true,
      },
      corners: {
        mode: "individual",
        layout: "corner",
        sources: {
          topLeft:
            "/images/invitation-decorations/floral-romantic/corner-top-left.webp",
          topRight:
            "/images/invitation-decorations/floral-romantic/corner-top-right.webp",
          bottomLeft:
            "/images/invitation-decorations/floral-romantic/corner-bottom-left.webp",
          bottomRight:
            "/images/invitation-decorations/floral-romantic/corner-bottom-right.webp",
        },
      },
      textContrast: true,
      opacity: 0.7,
      couture: true,
    }),
  },
  "javanese-traditional": {
    essential: essentialVisual,
    signature: premiumVisual({
      overlay: {
        src: "/images/invitation-decorations/javanese-traditional/overlay.svg",
        mode: "frame",
        objectFit: "cover",
        desktopInstances: 1,
        mobileInstances: 1,
        perimeterMask: true,
      },
      corners: {
        mode: "individual",
        layout: "corner",
        sources: {
          topRight:
            "/images/invitation-decorations/javanese-traditional/corner-top-right.webp",
          bottomLeft:
            "/images/invitation-decorations/javanese-traditional/corner-bottom-left.webp",
        },
      },
      textContrast: false,
      opacity: 0.7,
    }),
    couture: premiumVisual({
      overlay: {
        src: "/images/invitation-decorations/javanese-traditional/overlay.svg",
        mode: "frame",
        objectFit: "cover",
        desktopInstances: 1,
        mobileInstances: 1,
        perimeterMask: true,
      },
      corners: {
        mode: "individual",
        layout: "corner",
        sources: {
          topRight:
            "/images/invitation-decorations/javanese-traditional/corner-top-right.webp",
          bottomLeft:
            "/images/invitation-decorations/javanese-traditional/corner-bottom-left.webp",
        },
      },
      textContrast: false,
      opacity: 0.7,
      couture: true,
    }),
  },
};

export function getPremiumVisualConfig(
  theme: RendererKey,
  packageCode: PackageCode,
): PremiumVisualConfig {
  return premiumVisualConfig[theme][packageCode];
}

export function resolvePackageCode(
  value: string | null | undefined,
): PackageCode {
  if (value === "bespoke") {
    return "couture";
  }
  if (value === "essential" || value === "signature" || value === "couture") {
    return value;
  }
  return "essential";
}
