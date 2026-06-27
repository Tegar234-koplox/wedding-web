import type { InvitationEnvelope } from "@wedding/invitation-themes";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicRSVPForm } from "@/components/invitations/public-rsvp-form";
import { InvitationRenderer } from "@/invitations/renderer-registry";
import { resolvePackageCode } from "@/invitations/presentation";
import {
  fetchInvitationWeather,
  fetchPublicInvitation,
} from "@/lib/api/public";
import { isLocale } from "@/lib/locales";

type PublicInvitationPageProps = {
  params: Promise<{ locale: string; publicSlug: string }>;
  searchParams?: Promise<{ guest?: string }>;
};

export async function generateMetadata({
  params,
}: PublicInvitationPageProps): Promise<Metadata> {
  const { publicSlug } = await params;
  const invitation = await fetchPublicInvitation(publicSlug);
  if (!invitation) {
    return {};
  }

  const { partnerOne, partnerTwo } = invitation.content.couple;
  return {
    title: `${partnerOne} & ${partnerTwo}`,
    description: `Wedding invitation for ${partnerOne} and ${partnerTwo}.`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicInvitationPage({
  params,
  searchParams,
}: PublicInvitationPageProps) {
  const { locale, publicSlug } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) {
    notFound();
  }

  const [invitation, weather] = await Promise.all([
    fetchPublicInvitation(publicSlug),
    fetchInvitationWeather(publicSlug),
  ]);
  if (!invitation) {
    notFound();
  }

  const localizedInvitation: InvitationEnvelope = {
    rendererKey: invitation.rendererKey,
    rendererVersion: invitation.rendererVersion,
    contentSchemaVersion: invitation.contentSchemaVersion,
    locale,
    content: invitation.content,
  };

  return (
    <>
      <InvitationRenderer
        audio={invitation.audio}
        invitation={localizedInvitation}
        packageCode={resolvePackageCode(invitation.package_code)}
        weather={weather}
      />
      <PublicRSVPForm initialToken={query?.guest} publicSlug={publicSlug} />
    </>
  );
}
