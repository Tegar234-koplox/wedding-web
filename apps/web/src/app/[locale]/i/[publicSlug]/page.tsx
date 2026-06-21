import type { InvitationEnvelope } from "@wedding/invitation-themes";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InvitationRenderer } from "@/invitations/renderer-registry";
import {
  fetchInvitationWeather,
  fetchPublicInvitation,
} from "@/lib/api/public";
import { isLocale } from "@/lib/locales";

type PublicInvitationPageProps = {
  params: Promise<{ locale: string; publicSlug: string }>;
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
}: PublicInvitationPageProps) {
  const { locale, publicSlug } = await params;
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
    <InvitationRenderer invitation={localizedInvitation} weather={weather} />
  );
}
