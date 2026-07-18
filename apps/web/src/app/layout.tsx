import type { Metadata } from "next";
import type { ReactNode } from "react";

import { NiskalaAppStatus } from "@/components/site/niskala-app-status";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
  title: {
    default: "Niskala · Digital Wedding Invitations",
    template: "%s · Niskala",
  },
  description:
    "Premium editorial digital wedding invitations, crafted in Indonesia.",
  openGraph: {
    title: "Niskala · Digital Wedding Invitations",
    description:
      "Premium editorial digital wedding invitations, crafted in Indonesia.",
    type: "website",
    locale: "id_ID",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="id">
      <body>
        <NiskalaAppStatus />
        {children}
      </body>
    </html>
  );
}
