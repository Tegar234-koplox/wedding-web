import {
  packageCapabilities,
  type InvitationEnvelope,
} from "@wedding/invitation-themes";
import type { Metadata } from "next";
import { cookies } from "next/headers";
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

async function invitationAccessCookieHeader(): Promise<string> {
  const store = await cookies();
  return [
    "__Host-niskala_guest",
    "niskala_guest",
    "__Host-niskala_client",
    "niskala_client",
    "__Host-niskala_preview",
    "niskala_preview",
  ]
    .flatMap((name) => {
      const value = store.get(name)?.value;
      return value ? [`${name}=${value}`] : [];
    })
    .join("; ");
}

export async function generateMetadata({
  params,
  searchParams,
}: PublicInvitationPageProps): Promise<Metadata> {
  const { publicSlug } = await params;
  const query = await searchParams;
  const invitation = await fetchPublicInvitation(
    publicSlug,
    query?.preview,
    query?.guest,
    await invitationAccessCookieHeader(),
  );
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
  const accessCookie = await invitationAccessCookieHeader();
  if (!isLocale(locale)) {
    notFound();
  }

  const [invitation, weather] = await Promise.all([
    fetchPublicInvitation(
      publicSlug,
      query?.preview,
      query?.guest,
      accessCookie,
    ),
    fetchInvitationWeather(publicSlug, query?.preview, accessCookie),
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
    guest: invitation.guest,
  };
  const packageCode = resolvePackageCode(invitation.package_code);
  const rsvpEnabled = packageCapabilities[packageCode].rsvp;

  return (
    <InvitationRenderer
      audio={invitation.audio}
      cover={invitation.cover}
      invitation={localizedInvitation}
      packageCode={packageCode}
      rsvpSlot={
        rsvpEnabled ? (
          <PublicRSVPForm
            embedded
            initialToken={query?.guest}
            publicSlug={publicSlug}
            sessionAccess={/(?:^|;\s*)(?:__Host-)?niskala_guest=/.test(
              accessCookie,
            )}
          />
        ) : undefined
      }
      weather={weather}
    />
  );
}
