import { MessageCircle } from "lucide-react";

import { WhatsAppLink } from "@/components/site/whatsapp-link";
import type { Locale } from "@/lib/locales";

export function MobileWhatsApp({ locale }: { locale: Locale }) {
  return (
    <WhatsAppLink
      aria-label={
        locale === "id" ? "Konsultasi melalui WhatsApp" : "Consult via WhatsApp"
      }
      className="fixed bottom-4 right-4 z-40 size-13 rounded-full px-0 shadow-2xl md:hidden"
      locale={locale}
    >
      <MessageCircle size={19} />
    </WhatsAppLink>
  );
}
