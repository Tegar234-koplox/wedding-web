import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { Theme } from "@/content/site";
import type { Locale } from "@/lib/locales";

type ThemeCardProps = {
  index: number;
  locale: Locale;
  theme: Theme;
  priority?: boolean;
};

export function ThemeCard({
  index,
  locale,
  theme,
  priority = false,
}: ThemeCardProps) {
  return (
    <article className="group" data-reveal>
      <Link
        aria-label={`${locale === "id" ? "Lihat tema" : "View theme"} ${theme.name[locale]}`}
        className="block"
        href={`/${locale}/themes/${theme.slug}` as const}
      >
        <div className="relative aspect-[3/4] overflow-hidden bg-[var(--color-surface)]">
          <Image
            alt={`${theme.name[locale]} wedding invitation mood`}
            className="object-cover transition duration-700 ease-out group-hover:scale-[1.035]"
            fill
            priority={priority}
            sizes="(max-width: 767px) 88vw, (max-width: 1199px) 45vw, 31vw"
            src={theme.image}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/5" />
          <span className="absolute left-5 top-5 border border-white/35 px-3 py-2 text-[0.6rem] uppercase tracking-[0.2em] text-white">
            0{index + 1}
          </span>
          <ArrowUpRight
            aria-hidden
            className="absolute right-5 top-5 text-white transition duration-300 group-hover:-translate-y-1 group-hover:translate-x-1"
            size={22}
          />
          <div className="absolute inset-x-5 bottom-5 text-white">
            <p className="text-[0.6rem] uppercase tracking-[0.2em] text-white/70">
              {theme.category[locale]}
            </p>
            <h2 className="mt-2 font-serif text-4xl leading-none">
              {theme.name[locale]}
            </h2>
          </div>
        </div>
        <p className="mt-5 max-w-md text-sm leading-6 text-[var(--color-muted)]">
          {theme.description[locale]}
        </p>
      </Link>
    </article>
  );
}
