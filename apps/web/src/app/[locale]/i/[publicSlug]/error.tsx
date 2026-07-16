"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function PublicInvitationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#11110f] px-6 text-center text-[#f4efe5]">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-[#c6a75b]">
          Niskala
        </p>
        <h1 className="mt-5 font-serif text-5xl">Undangan belum dapat dimuat.</h1>
        <p className="mx-auto mt-5 max-w-md text-sm leading-7 text-white/65">
          Layanan sedang merespons lebih lambat dari biasanya. Undangan Anda tetap
          tersedia; silakan coba lagi.
        </p>
        <button
          className="mt-8 min-h-12 border border-[#c6a75b] px-6 text-xs font-semibold uppercase tracking-[0.2em]"
          onClick={reset}
          type="button"
        >
          Coba lagi
        </button>
      </div>
    </main>
  );
}
