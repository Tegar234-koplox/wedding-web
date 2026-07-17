"use client";

import type { PackageCode, RendererKey } from "@wedding/invitation-themes";
import { useInView } from "framer-motion";
import React, { useRef } from "react";

import type { ThemeVisual } from "@/invitations/presentation";

import cardStyles from "./invitation-card.module.css";

const subtleFrameThemes = new Set<RendererKey>([
  "elegant-classic",
  "floral-romantic",
  "islamic-soft",
  "minimalist-white",
]);

function frameClasses(design: ThemeVisual, packageCode: PackageCode) {
  const tierClass =
    packageCode === "couture"
      ? cardStyles.couture
      : packageCode === "signature"
        ? cardStyles.signature
        : cardStyles.essential;
  return `${cardStyles.frame} ${tierClass} ${subtleFrameThemes.has(design.key) ? cardStyles.subtle : ""}`;
}

function frameStyle(design: ThemeVisual) {
  return {
    "--card-border": design.cardBorderColor,
    "--card-glow": design.cardGlowColor,
    "--card-shine": design.cardShineColor,
  } as React.CSSProperties;
}

export function InvitationCard({
  children,
  className = "",
  contentClassName = "",
  context,
  design,
  packageCode,
  photo = false,
  surfaceClassName,
}: {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  context?: string;
  design: ThemeVisual;
  packageCode: PackageCode;
  photo?: boolean;
  surfaceClassName?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const isNearViewport = useInView(cardRef, {
    amount: 0.05,
    margin: "180px 0px",
  });
  const subtle = subtleFrameThemes.has(design.key);

  return (
    <div
      className={`${frameClasses(design, packageCode)} ${photo && packageCode === "couture" ? cardStyles.couturePhoto : ""} ${className}`}
      data-card-active={isNearViewport}
      data-card-context={context}
      data-invitation-card={packageCode}
      data-frame-style={subtle ? "subtle" : "standard"}
      data-frame-motion={packageCode === "essential" ? "static" : "animated"}
      data-photo-card={photo || undefined}
      ref={cardRef}
      style={frameStyle(design)}
    >
      <div
        className={`${cardStyles.content} ${surfaceClassName ?? design.surface} ${contentClassName}`}
      >
        {children}
      </div>
    </div>
  );
}

export function InvitationFrame({
  className = "",
  design,
  packageCode,
}: {
  className?: string;
  design: ThemeVisual;
  packageCode: PackageCode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const isNearViewport = useInView(frameRef, {
    amount: 0.05,
    margin: "180px 0px",
  });
  const subtle = subtleFrameThemes.has(design.key);

  return (
    <div
      aria-hidden="true"
      className={`${frameClasses(design, packageCode)} ${cardStyles.coverFrame} ${className}`}
      data-card-active={isNearViewport}
      data-cover-frame={packageCode}
      data-frame-style={subtle ? "subtle" : "standard"}
      data-frame-motion="static"
      ref={frameRef}
      style={{ ...frameStyle(design), position: "absolute" }}
    >
      <div className={`${cardStyles.content} bg-transparent`} />
    </div>
  );
}
