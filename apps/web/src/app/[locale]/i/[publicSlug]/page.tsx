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
  searchParams?: Promise<{ guest?: string; preview?: string }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: PublicInvitationPageProps): Promise<Metadata> {
  const { publicSlug } = await params;
  const query = await searchParams;
  const invitation = await fetchPublicInvitation(publicSlug, query?.preview);
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
    fetchPublicInvitation(publicSlug, query?.preview),
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
  const packageCode = resolvePackageCode(invitation.package_code);
  const renderRsvpInsideInvitation =
    packageCode === "signature" || packageCode === "couture";
  const rsvpForm = (
    <PublicRSVPForm
      embedded={renderRsvpInsideInvitation}
      initialToken={query?.guest}
      previewToken={query?.preview}
      publicSlug={publicSlug}
    />
  );

  return (
    <>
      <InvitationRenderer
        audio={invitation.audio}
        invitation={localizedInvitation}
        packageCode={packageCode}
        rsvpSlot={renderRsvpInsideInvitation ? rsvpForm : undefined}
        weather={weather}
      />
      {renderRsvpInsideInvitation ? null : rsvpForm}
    </>
  );
}
