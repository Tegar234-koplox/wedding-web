"use client";

import React, { type KeyboardEvent, type MouseEvent, useState } from "react";

import { cn } from "@/lib/utils";

export type CoverPreviewMode = "mobile" | "tablet" | "desktop";

type CoverFocalPreviewProps = {
  focalX: number;
  focalY: number;
  onFocalChange: (x: number, y: number) => void;
  photoUrl: string;
};

const previewModes: Array<{
  description: string;
  id: CoverPreviewMode;
  label: string;
  previewClassName: string;
  ratio: string;
}> = [
  {
    description:
      "Menunjukkan crop horizontal yang paling umum pada undangan ponsel.",
    id: "mobile",
    label: "Mobile",
    previewClassName: "aspect-[9/16] max-w-[22rem]",
    ratio: "9:16",
  },
  {
    description:
      "Menunjukkan komposisi menengah untuk tablet dalam posisi portrait.",
    id: "tablet",
    label: "Tablet",
    previewClassName: "aspect-[3/4] max-w-[30rem]",
    ratio: "3:4",
  },
  {
    description:
      "Menunjukkan crop vertikal yang umum pada layar desktop landscape.",
    id: "desktop",
    label: "Desktop",
    previewClassName: "aspect-[16/9] max-w-none",
    ratio: "16:9",
  },
];

export function normalizeFocalPoint(value: number | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 50;
}

export function CoverFocalPreview({
  focalX,
  focalY,
  onFocalChange,
  photoUrl,
}: CoverFocalPreviewProps) {
  const [previewMode, setPreviewMode] = useState<CoverPreviewMode>("mobile");
  const activeMode =
    previewModes.find((mode) => mode.id === previewMode) ?? previewModes[0]!;

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (event.detail === 0) {
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) {
      return;
    }
    onFocalChange(
      normalizeFocalPoint(((event.clientX - bounds.left) / bounds.width) * 100),
      normalizeFocalPoint(((event.clientY - bounds.top) / bounds.height) * 100),
    );
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? 5 : 1;
    const offsets: Partial<Record<typeof event.key, { x: number; y: number }>> =
      {
        ArrowDown: { x: 0, y: step },
        ArrowLeft: { x: -step, y: 0 },
        ArrowRight: { x: step, y: 0 },
        ArrowUp: { x: 0, y: -step },
      };
    const offset = offsets[event.key];
    if (!offset) {
      return;
    }
    event.preventDefault();
    onFocalChange(
      normalizeFocalPoint(focalX + offset.x),
      normalizeFocalPoint(focalY + offset.y),
    );
  }

  return (
    <div className="border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-gold)]">
            Posisi fokus cover
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
            Pilih ukuran layar, lalu klik subjek utama pada foto. Gunakan tombol
            panah untuk menggeser 1%, atau Shift + tombol panah untuk 5%.
          </p>
        </div>
        <button
          className="inline-flex min-h-11 items-center justify-center border border-white/15 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-white/70 transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
          onClick={() => onFocalChange(50, 50)}
          type="button"
        >
          Reset 50/50
        </button>
      </div>

      <div
        aria-label="Ukuran preview cover"
        className="mt-4 grid grid-cols-3 gap-2"
        role="group"
      >
        {previewModes.map((mode) => {
          const active = mode.id === previewMode;
          return (
            <button
              aria-pressed={active}
              className={cn(
                "min-h-11 border px-2 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.12em] transition",
                active
                  ? "border-[var(--color-gold)] bg-[color-mix(in_srgb,var(--color-gold)_12%,transparent)] text-[var(--color-gold)]"
                  : "border-white/12 text-white/50 hover:border-white/30 hover:text-white/80",
              )}
              key={mode.id}
              onClick={() => setPreviewMode(mode.id)}
              type="button"
            >
              <span className="block">{mode.label}</span>
              <span className="mt-1 block text-[0.58rem] font-normal tracking-[0.08em] opacity-70">
                {mode.ratio}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs leading-5 text-white/45">
        {activeMode.description} Mode preview tidak membuat crop terpisah; semua
        perangkat memakai titik fokus X/Y yang sama.
      </p>

      <div className="mt-4 flex justify-center overflow-hidden">
        <button
          aria-label={`Atur titik fokus cover pada preview ${activeMode.label}. Posisi saat ini ${Math.round(focalX)} persen horizontal dan ${Math.round(focalY)} persen vertikal.`}
          className={cn(
            "relative w-full overflow-hidden border border-white/15 bg-[#12120f] bg-cover bg-no-repeat outline-none transition focus:border-[var(--color-gold)] disabled:cursor-not-allowed disabled:opacity-60",
            activeMode.previewClassName,
          )}
          data-preview-mode={activeMode.id}
          data-testid="cover-focal-surface"
          disabled={!photoUrl.trim()}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          style={{
            backgroundImage: photoUrl.trim()
              ? `url(${JSON.stringify(photoUrl.trim())})`
              : undefined,
            backgroundPosition: `${focalX}% ${focalY}%`,
          }}
          type="button"
        >
          {!photoUrl.trim() ? (
            <span className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/40">
              Isi URL Cloudinary untuk menampilkan preview cover.
            </span>
          ) : (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/90 bg-black/20 shadow-[0_0_0_1px_rgba(0,0,0,0.55)]"
              style={{ left: `${focalX}%`, top: `${focalY}%` }}
            >
              <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/90" />
              <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/90" />
            </span>
          )}
        </button>
      </div>

      <p className="mt-3 text-xs uppercase tracking-[0.14em] text-white/45">
        X {Math.round(focalX)}% · Y {Math.round(focalY)}% · {activeMode.label}{" "}
        {activeMode.ratio}
      </p>
      <p className="mt-2 text-xs leading-5 text-white/40">
        Rekomendasi satu foto responsif: rasio 4:5, minimal 1080×1350 px, dengan
        subjek utama di area tengah.
      </p>
    </div>
  );
}
