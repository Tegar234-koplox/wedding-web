import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { DocumentLocale } from "@/components/site/document-locale";
import { MotionScope } from "@/components/site/motion-scope";
import { isLocale, locales } from "@/lib/locales";

type LocaleLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams(): Array<{ locale: string }> {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return (
    <>
      <DocumentLocale locale={locale} />
      <a className="skip-link" href="#main-content">
        {locale === "id" ? "Lewati ke konten utama" : "Skip to main content"}
      </a>
      <div id="main-content" tabIndex={-1}>
        <MotionScope>{children}</MotionScope>
      </div>
    </>
  );
}
