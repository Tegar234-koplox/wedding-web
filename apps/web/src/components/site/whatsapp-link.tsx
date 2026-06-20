import type { AnchorHTMLAttributes, ReactNode } from "react";

import type { Locale } from "@/lib/locales";
import { cn } from "@/lib/utils";
import { createWhatsAppUrl } from "@/lib/whatsapp";

type WhatsAppLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  locale: Locale;
  theme?: string;
  packageCode?: string;
  variant?: "gold" | "outline" | "text";
};

export function WhatsAppLink({
  children,
  className,
  locale,
  theme,
  packageCode,
  variant = "gold",
  ...props
}: WhatsAppLinkProps) {
  return (
    <a
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-3 px-6 text-xs font-semibold uppercase tracking-[0.2em] transition duration-300",
        variant === "gold" &&
          "bg-[var(--color-gold)] text-[#14120d] hover:bg-[var(--color-gold-soft)]",
        variant === "outline" &&
          "border border-[var(--color-rule-light)] hover:border-[var(--color-gold)] hover:text-[var(--color-gold-soft)]",
        variant === "text" &&
          "min-h-0 px-0 underline decoration-[var(--color-gold)] underline-offset-8",
        className,
      )}
      href={createWhatsAppUrl({ locale, theme, packageCode })}
      rel="noreferrer"
      target="_blank"
      {...props}
    >
      {children}
    </a>
  );
}
