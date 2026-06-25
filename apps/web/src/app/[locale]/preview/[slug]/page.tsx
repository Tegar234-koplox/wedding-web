import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";

import { PreviewBackButton } from "@/components/site/preview-back-button";
import { PreviewPackageSelector } from "@/components/site/preview-package-selector";
import { themes } from "@/content/site";
import { InvitationRenderer } from "@/invitations/renderer-registry";
import { resolvePackageCode } from "@/invitations/presentation";
import { getSampleInvitation } from "@/invitations/samples";
import { isLocale, locales } from "@/lib/locales";

type PreviewPageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ package?: string }>;
};

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    themes.map((theme) => ({ locale, slug: theme.slug })),
  );
}

export async function generateMetadata({
  params,
}: PreviewPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const theme = themes.find((item) => item.slug === slug);

  if (!theme || !isLocale(locale)) {
    return {};
  }

  return {
    title: `${theme.name[locale]} Preview`,
    description: `A live sample of the ${theme.name[locale]} digital wedding invitation theme.`,
    robots: { index: false, follow: false },
  };
}

export default async function PreviewPage({
  params,
  searchParams,
}: PreviewPageProps) {
  const { locale, slug } = await params;
  const query = await searchParams;
  const theme = themes.find((item) => item.slug === slug);

  if (!isLocale(locale) || !theme) {
    notFound();
  }

  const invitation = getSampleInvitation(theme.slug, locale);
  const packageCode = resolvePackageCode(query.package);

  return (
    <>
      <PreviewBackButton
        href={`/${locale}/themes/${slug}` as Route}
        label={locale === "id" ? "Kembali ke tema" : "Back to theme"}
      />
      <PreviewPackageSelector
        locale={locale}
        selected={packageCode}
        theme={theme.name[locale]}
      />
      <InvitationRenderer invitation={invitation} packageCode={packageCode} />
    </>
  );
}
