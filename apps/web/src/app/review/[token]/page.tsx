import type { Metadata } from "next";

import { BespokeReviewWorkspace } from "@/components/bespoke-review/bespoke-review-workspace";

export const metadata: Metadata = {
  title: "Bespoke Review",
  description: "Secure Niskala Bespoke scope and final approval.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function BespokeReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <BespokeReviewWorkspace token={token} />;
}
