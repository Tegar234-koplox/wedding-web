"use client";

import type { PackageCode } from "@wedding/invitation-themes";
import { useInView } from "framer-motion";
import React, { useRef } from "react";

import type { ThemeVisual } from "@/invitations/presentation";

import cardStyles from "./invitation-card.module.css";

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
  const tierClass =
    packageCode === "couture"
      ? cardStyles.couture
      : packageCode === "signature"
        ? cardStyles.signature
        : cardStyles.essential;
  const style = {
    "--card-border": design.cardBorderColor,
    "--card-glow": design.cardGlowColor,
    "--card-shine": design.cardShineColor,
  } as React.CSSProperties;

  return (
    <div
      className={`${cardStyles.frame} ${tierClass} ${photo && packageCode === "couture" ? cardStyles.couturePhoto : ""} ${className}`}
      data-card-active={isNearViewport}
      data-card-context={context}
      data-invitation-card={packageCode}
      data-photo-card={photo || undefined}
      ref={cardRef}
      style={style}
    >
      <div
        className={`${cardStyles.content} ${surfaceClassName ?? design.surface} ${contentClassName}`}
      >
        {children}
      </div>
    </div>
  );
}
