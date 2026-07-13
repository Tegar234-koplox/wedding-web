import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EditorialHome } from "@/components/site/home-page";
import { isLocale } from "@/lib/locales";

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

export const metadata: Metadata = {
  title: "Digital Wedding Invitation",
  description:
    "Editorial digital wedding invitations with curated themes, graceful motion, and thoughtful guest information.",
};

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return <EditorialHome locale={locale} />;
}
