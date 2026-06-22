import type { Locale } from "@/lib/locales";

const fallbackNumber = "6281997452212";

type WhatsAppContext = {
  locale: Locale;
  theme?: string;
  packageCode?: string;
};

export function createWhatsAppUrl({
  locale,
  theme,
  packageCode,
}: WhatsAppContext): string {
  const number =
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") ||
    fallbackNumber;
  const details = [
    theme && `theme ${theme}`,
    packageCode && `package ${packageCode}`,
  ]
    .filter(Boolean)
    .join(" dan ");
  const message =
    locale === "id"
      ? `Halo, saya tertarik dengan layanan undangan digital${details ? ` untuk ${details}` : ""}. Boleh saya konsultasi?`
      : `Hello, I am interested in your digital invitation service${details ? ` for ${details}` : ""}. May I schedule a consultation?`;

  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
