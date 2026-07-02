import type { Metadata } from "next";
import { notFound } from "next/navigation";

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

const livePreviewAudio = {
  default_volume: 0.35,
  loop: true,
  secure_url: "/audio/niskala-preview-ambient.wav",
  title: "Niskala preview music",
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
      <PreviewPackageSelector
        locale={locale}
        selected={packageCode}
        theme={theme.name[locale]}
      />
      <InvitationRenderer
        audio={livePreviewAudio}
        invitation={invitation}
        packageCode={packageCode}
      />
    </>
  );
}
