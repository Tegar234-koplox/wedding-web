import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import React from "react";

import type {
  CornerAssets,
  OverlayAsset,
  PremiumVisualConfig,
  ThemeVisual,
} from "@/invitations/presentation";

type ThemeOrnamentProps = {
  design: ThemeVisual;
  intensity?: "quiet" | "full";
};

export function ThemeOrnament({
  design,
  intensity = "full",
}: ThemeOrnamentProps) {
  const opacity = intensity === "quiet" ? "opacity-25" : "opacity-55";

  if (design.ornament === "islamic") {
    return (
      <svg aria-hidden className={`size-full ${opacity}`} viewBox="0 0 200 240">
        <path
          d="M24 224V93C24 48 58 16 100 16s76 32 76 77v131"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M48 224V102c0-31 23-57 52-57s52 26 52 57v122"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        />
        <path
          d="m100 67 13 22-13 22-13-22Z"
          fill="none"
          stroke="currentColor"
        />
      </svg>
    );
  }

  if (design.ornament === "floral") {
    return (
      <svg aria-hidden className={`size-full ${opacity}`} viewBox="0 0 220 220">
        <path
          d="M25 205c52-61 69-119 73-180M92 82c-28-10-45 3-53 26 29 6 44-3 53-26Zm5-18c23-20 47-13 60 5-22 19-43 18-60-5Zm-17 75c-30-3-43 13-45 37 30-1 43-14 45-37Zm6 5c20-21 44-19 61-3-18 23-39 24-61 3Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        />
        <circle cx="99" cy="24" r="7" fill="none" stroke="currentColor" />
      </svg>
    );
  }

  if (design.ornament === "batik") {
    return (
      <svg aria-hidden className={`size-full ${opacity}`} viewBox="0 0 240 240">
        <defs>
          <pattern
            height="48"
            id="kawung"
            patternUnits="userSpaceOnUse"
            width="48"
          >
            <ellipse
              cx="24"
              cy="12"
              fill="none"
              rx="10"
              ry="18"
              stroke="currentColor"
            />
            <ellipse
              cx="24"
              cy="36"
              fill="none"
              rx="10"
              ry="18"
              stroke="currentColor"
            />
            <ellipse
              cx="12"
              cy="24"
              fill="none"
              rx="18"
              ry="10"
              stroke="currentColor"
            />
            <ellipse
              cx="36"
              cy="24"
              fill="none"
              rx="18"
              ry="10"
              stroke="currentColor"
            />
          </pattern>
        </defs>
        <rect fill="url(#kawung)" height="240" width="240" />
      </svg>
    );
  }

  if (design.ornament === "filigree") {
    return (
      <svg aria-hidden className={`size-full ${opacity}`} viewBox="0 0 220 220">
        <path
          d="M18 108C18 52 52 18 108 18M18 74c28 0 46-16 46-46M18 45c18 0 27-9 27-27M37 108c0-42 29-71 71-71M55 108c0-31 22-53 53-53M108 202c56 0 94-38 94-94M156 202c0-28 18-46 46-46M175 202c0-18 9-27 27-27M108 183c42 0 75-33 75-75"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (design.ornament === "cinematic") {
    return (
      <div
        aria-hidden
        className={`size-full border-y border-current ${opacity}`}
      >
        <div className="absolute bottom-4 left-4 top-4 w-px bg-current" />
        <div className="absolute bottom-4 right-4 top-4 w-px bg-current" />
        <span className="absolute left-7 top-7 font-serif text-7xl">01</span>
      </div>
    );
  }

  if (design.ornament === "foil") {
    return (
      <div aria-hidden className={`size-full ${opacity}`}>
        <div className="absolute inset-3 border border-current" />
        <div className="absolute inset-7 border border-current/50" />
        <div className="absolute left-1/2 top-1/2 h-px w-28 -translate-x-1/2 bg-current" />
        <div className="absolute left-1/2 top-1/2 h-28 w-px -translate-y-1/2 bg-current" />
      </div>
    );
  }

  return (
    <div aria-hidden className={`size-full ${opacity}`}>
      <div className="absolute left-0 right-0 top-1/2 h-px bg-current" />
      <div className="absolute bottom-0 left-1/2 top-0 w-px bg-current/25" />
    </div>
  );
}

type DecorationProps = {
  config: PremiumVisualConfig;
};

export function shouldAnimatePremium(
  config: PremiumVisualConfig,
  reducedMotion: boolean | null,
  layer: "cover" | "content",
): boolean {
  return (
    !reducedMotion &&
    (layer === "cover" ? config.coverAnimated : config.contentAnimated)
  );
}

function AssetImage({
  className,
  objectFit,
  objectPosition,
  src,
  sizes = "100vw",
}: {
  className?: string;
  objectFit: "contain" | "cover" | "fill";
  objectPosition?: string;
  src: string;
  sizes?: string;
}) {
  return (
    <Image
      alt=""
      aria-hidden
      className={`${objectFit === "fill" ? "object-fill" : objectFit === "cover" ? "object-cover" : "object-contain"} ${className ?? ""}`}
      fill
      sizes={sizes}
      src={src}
      style={{ objectPosition }}
      unoptimized={src.endsWith(".svg")}
    />
  );
}

function OverlayArtwork({
  animated,
  asset,
}: {
  animated: boolean;
  asset: OverlayAsset;
}) {
  const mask = asset.perimeterMask
    ? {
        maskImage:
          "radial-gradient(ellipse at center, transparent 0%, transparent 35%, black 68%, black 100%)",
        WebkitMaskImage:
          "radial-gradient(ellipse at center, transparent 0%, transparent 35%, black 68%, black 100%)",
      }
    : undefined;

  if (asset.mode === "frame") {
    const frameTransition = {
      duration: 13,
      ease: [0.45, 0, 0.55, 1] as const,
      repeat: Infinity,
      times: [0, 0.24, 0.52, 0.76, 1],
    };

    return (
      <>
        {asset.mobileBlend === "side-pair" ? (
          <div className="absolute inset-0 md:hidden" style={mask}>
            <motion.div
              animate={
                animated
                  ? {
                      opacity: [0.86, 1, 0.9, 0.98, 0.86],
                      rotate: [-0.35, 0.45, -0.2, 0.3, -0.35],
                      scale: [1, 1.03, 1.012, 1.026, 1],
                      x: ["-1.5%", "1.8%", "-0.6%", "1.1%", "-1.5%"],
                      y: ["1%", "-2%", "1.4%", "-0.5%", "1%"],
                    }
                  : undefined
              }
              className="absolute inset-0 opacity-85"
              transition={frameTransition}
            >
              <AssetImage
                objectFit={asset.objectFit}
                objectPosition="left center"
                src={asset.src}
              />
            </motion.div>
            <motion.div
              animate={
                animated
                  ? {
                      opacity: [0.86, 0.98, 0.9, 1, 0.86],
                      rotate: [0.35, -0.45, 0.2, -0.3, 0.35],
                      scale: [1, 1.03, 1.012, 1.026, 1],
                      x: ["1.5%", "-1.8%", "0.6%", "-1.1%", "1.5%"],
                      y: ["-1%", "2%", "-1.4%", "0.5%", "-1%"],
                    }
                  : undefined
              }
              className="absolute inset-0 opacity-85"
              transition={{
                ...frameTransition,
                delay: 0.7,
              }}
            >
              <AssetImage
                objectFit={asset.objectFit}
                objectPosition="right center"
                src={asset.src}
              />
            </motion.div>
          </div>
        ) : null}
        <motion.div
          animate={
            animated
              ? {
                  opacity: [0.88, 1, 0.91, 0.98, 0.88],
                  rotate: [-0.4, 0.5, -0.25, 0.35, -0.4],
                  scale: [1, 1.03, 1.012, 1.026, 1],
                  x: ["-1.4%", "1.6%", "-0.5%", "1%", "-1.4%"],
                  y: ["1%", "-2.1%", "1.3%", "-0.6%", "1%"],
                }
              : undefined
          }
          className={`absolute inset-0 ${asset.mobileBlend === "side-pair" ? "hidden md:block" : ""}`}
          style={mask}
          transition={frameTransition}
        >
          <AssetImage objectFit={asset.objectFit} src={asset.src} />
        </motion.div>
      </>
    );
  }

  const positions = [
    "-right-[8%] top-[2%]",
    "-left-[10%] bottom-[1%] rotate-[-12deg]",
    "right-[2%] bottom-[15%] hidden md:block rotate-[18deg]",
  ];

  return (
    <>
      {positions.slice(0, asset.desktopInstances).map((position, index) => (
        <motion.div
          animate={
            animated
              ? {
                  rotate: [index * 5, index * 5 + 3, index * 5],
                  scale: [1, 1.03, 1],
                  y: [0, index % 2 ? 7 : -7, 0],
                }
              : undefined
          }
          className={`absolute aspect-[3/2] w-[clamp(8rem,20vw,16rem)] ${position} ${
            index >= asset.mobileInstances ? "hidden md:block" : ""
          }`}
          data-overlay-instance
          key={`${asset.src}-${index}`}
          transition={{
            delay: index * 0.8,
            duration: 11 + index,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        >
          <AssetImage
            objectFit={asset.objectFit}
            src={asset.src}
            sizes="32vw"
          />
        </motion.div>
      ))}
    </>
  );
}

function CornerArtwork({ corners }: { corners: CornerAssets }) {
  if (corners.mode === "frame") {
    if (corners.placement === "quadrants") {
      const quadrants = [
        ["left-0 top-0", "left top"],
        ["right-0 top-0", "right top"],
        ["bottom-0 left-0", "left bottom"],
        ["bottom-0 right-0", "right bottom"],
      ] as const;

      return (
        <>
          {quadrants.map(([position, objectPosition]) => (
            <div
              className={`absolute aspect-square w-[clamp(8rem,28vw,20rem)] overflow-hidden md:w-[clamp(7rem,16vw,13rem)] ${position}`}
              key={objectPosition}
            >
              <AssetImage
                objectFit="cover"
                objectPosition={objectPosition}
                sizes="28vw"
                src={corners.src}
              />
            </div>
          ))}
        </>
      );
    }

    return (
      <div className="absolute inset-0">
        <AssetImage objectFit={corners.objectFit} src={corners.src} />
      </div>
    );
  }

  const entries = [
    ["topLeft", "left-0 top-0"],
    ["topRight", "right-0 top-0"],
    ["bottomLeft", "bottom-0 left-0"],
    ["bottomRight", "bottom-0 right-0"],
  ] as const;

  const fullCanvas =
    corners.layout === "full-canvas" ||
    (corners.layout !== "corner" &&
      Object.values(corners.sources).every((src) => src?.endsWith(".webp")));

  if (fullCanvas) {
    return (
      <>
        {entries.map(([key]) => {
          const src = corners.sources[key];

          return src ? (
            <div className="absolute inset-0" key={key}>
              <AssetImage objectFit="cover" src={src} />
            </div>
          ) : null;
        })}
      </>
    );
  }

  return (
    <>
      {entries.map(([key, position]) => {
        const src = corners.sources[key];

        return src ? (
          <div
            className={`absolute aspect-square w-[clamp(7rem,22vw,20rem)] md:w-[clamp(6rem,13vw,12rem)] ${position}`}
            key={key}
          >
            <AssetImage
              objectFit="contain"
              sizes="22vw"
              src={src}
            />
          </div>
        ) : null;
      })}
    </>
  );
}

function OverlayLayer({
  animated,
  config,
  scope,
}: DecorationProps & {
  animated: boolean;
  scope: "cover" | "section";
}) {
  if (!config.overlay) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      data-animated={animated}
      data-decoration-layer={`${scope}-overlay`}
      style={{ opacity: config.opacity }}
    >
      <OverlayArtwork animated={animated} asset={config.overlay} />
    </div>
  );
}

function CornerLayer({
  config,
  scope,
}: DecorationProps & {
  scope: "cover" | "section";
}) {
  if (!config.corners) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      data-animated="false"
      data-decoration-layer={`${scope}-corners`}
      style={{ opacity: config.opacity }}
    >
      <CornerArtwork corners={config.corners} />
    </div>
  );
}

export function ThemeCoverDecoration({ config }: DecorationProps) {
  const reducedMotion = useReducedMotion();
  const animated = shouldAnimatePremium(config, reducedMotion, "cover");

  if (!config.overlay && !config.corners) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[2] overflow-hidden"
      data-decoration-layer="cover"
    >
      <OverlayLayer animated={animated} config={config} scope="cover" />
      <CornerLayer config={config} scope="cover" />
    </div>
  );
}

export function ThemeSectionDecoration({
  config,
  showOverlay,
}: DecorationProps & { showOverlay: boolean }) {
  const reducedMotion = useReducedMotion();
  const animated = shouldAnimatePremium(config, reducedMotion, "content");

  if (!config.corners && (!showOverlay || !config.overlay)) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
      data-decoration-layer="section"
    >
      {showOverlay ? (
        <OverlayLayer animated={animated} config={config} scope="section" />
      ) : null}
      <CornerLayer config={config} scope="section" />
    </div>
  );
}

export function CoverTextContrastLayer({ config }: DecorationProps) {
  if (!config.textContrast) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-[8%] bottom-[9%] top-[48%] z-[3] rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(246,238,222,.78),rgba(246,238,222,.38)_48%,transparent_76%)] blur-xl"
      data-decoration-layer="text-contrast"
    />
  );
}
