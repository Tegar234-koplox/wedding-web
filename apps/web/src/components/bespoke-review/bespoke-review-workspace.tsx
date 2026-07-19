"use client";

import {
  CheckCircle2,
  ExternalLink,
  KeyRound,
  MessageSquareText,
  Send,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Review = {
  purpose: "scope" | "final";
  expires_at: string;
  approved: boolean;
  stale: boolean;
  locale: "id" | "en";
  client_name: string;
  order_reference: string;
  public_slug: string;
  preview_token: string;
  scope: null | {
    version: number;
    status: string;
    scope: {
      summary?: string;
      deliverables?: string[];
      exclusions?: string[];
      commercial_rule?: string;
    };
    total_amount: string;
    currency: string;
    revision_limit: number;
    production_days_min: number;
    production_days_max: number;
  };
  revisions_used: number;
  otp: null | { channel: string; destination: string; delivery_status: string };
};

async function reviewFetch<T>(
  token: string,
  path = "",
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(
    `/api/bespoke-review/${encodeURIComponent(token)}${path ? `/${path}` : ""}`,
    {
      ...init,
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      payload?.error?.message ||
        Object.values(payload || {})
          .flat()
          .join(" ") ||
        "Request failed.",
    );
  return payload as T;
}

const copy = {
  id: {
    eyebrow: "Persetujuan Klien",
    title: "Review Bespoke",
    scope: "Scope yang disepakati",
    deliverables: "Termasuk",
    exclusions: "Di luar scope",
    preview: "Buka preview",
    requestRevision: "Minta revisi",
    revisionPlaceholder: "Tuliskan perubahan secara spesifik...",
    sendRevision: "Kirim permintaan",
    otp: "Kirim kode OTP",
    approve: "Setujui dengan OTP",
    code: "6 digit kode",
    approved: "Sudah disetujui dan tercatat.",
    stale: "Preview ini berubah setelah link dibuat. Minta link review baru.",
    sent: "Kode dikirim ke",
    rounds: "revisi terpakai",
    commercial: "Permintaan di luar scope menjadi change request berbayar.",
  },
  en: {
    eyebrow: "Client Approval",
    title: "Bespoke Review",
    scope: "Approved scope",
    deliverables: "Included",
    exclusions: "Out of scope",
    preview: "Open preview",
    requestRevision: "Request a revision",
    revisionPlaceholder: "Describe each requested change clearly...",
    sendRevision: "Send request",
    otp: "Send OTP",
    approve: "Approve with OTP",
    code: "6-digit code",
    approved: "Approved and recorded.",
    stale:
      "This preview changed after the link was issued. Request a new review link.",
    sent: "Code sent to",
    rounds: "revisions used",
    commercial: "Out-of-scope requests become paid change requests.",
  },
};

export function BespokeReviewWorkspace({ token }: { token: string }) {
  const [review, setReview] = useState<Review | null>(null);
  const [note, setNote] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setReview(await reviewFetch<Review>(token));
  }, [token]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((error) =>
        setMessage(error instanceof Error ? error.message : "Review failed."),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const text = copy[review?.locale || "id"];
  const previewUrl = useMemo(
    () =>
      review
        ? `/${review.locale}/i/${review.public_slug}?preview=${encodeURIComponent(review.preview_token)}`
        : "",
    [review],
  );

  async function act(path: string, body: object, success: string) {
    setBusy(true);
    setMessage("");
    try {
      await reviewFetch(token, path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setMessage(success);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!review)
    return (
      <main className="grid min-h-screen place-items-center bg-[#0d0c09] p-6 text-[#f5efe3]">
        <p>{message || "Loading..."}</p>
      </main>
    );
  const scope = review.scope;
  return (
    <main className="min-h-screen bg-[#0d0c09] px-5 py-12 text-[#f5efe3] md:px-10">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[.3em] text-[#d9b55a]">
          Niskala · {text.eyebrow}
        </p>
        <h1 className="mt-5 font-serif text-5xl md:text-7xl">{text.title}</h1>
        <p className="mt-3 text-white/55">
          {review.client_name} · {review.order_reference}
        </p>
        {message ? (
          <p className="mt-6 border border-[#d9b55a]/35 px-4 py-3 text-sm text-[#e7ca7e]">
            {message}
          </p>
        ) : null}
        {review.approved ? (
          <div className="mt-8 flex items-center gap-3 border border-emerald-400/40 bg-emerald-950/20 p-5 text-emerald-200">
            <CheckCircle2 /> {text.approved}
          </div>
        ) : null}
        {review.stale ? (
          <div className="mt-8 border border-red-400/40 bg-red-950/20 p-5 text-red-200">
            {text.stale}
          </div>
        ) : null}

        {scope ? (
          <section className="mt-9 border border-white/12 p-5 md:p-8">
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[.22em] text-[#d9b55a]">
                  {text.scope} · v{scope.version}
                </p>
                <h2 className="mt-3 font-serif text-3xl">
                  {scope.scope.summary}
                </h2>
              </div>
              <p className="text-xl">
                IDR{" "}
                {Number(scope.total_amount).toLocaleString(
                  review.locale === "id" ? "id-ID" : "en-US",
                )}
              </p>
            </div>
            <div className="mt-7 grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="text-sm uppercase tracking-[.16em] text-white/55">
                  {text.deliverables}
                </h3>
                <ul className="mt-3 space-y-2 text-sm leading-6">
                  {scope.scope.deliverables?.map((item) => (
                    <li key={item}>— {item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm uppercase tracking-[.16em] text-white/55">
                  {text.exclusions}
                </h3>
                <ul className="mt-3 space-y-2 text-sm leading-6">
                  {scope.scope.exclusions?.map((item) => (
                    <li key={item}>— {item}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-7 text-sm text-white/55">
              {scope.revision_limit} rounds · {scope.production_days_min}–
              {scope.production_days_max} working days · {text.commercial}
            </p>
          </section>
        ) : null}

        {review.purpose === "final" ? (
          <section className="mt-8 border border-white/12 p-5 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[.22em] text-[#d9b55a]">
                  Final check
                </p>
                <p className="mt-2 text-sm text-white/55">
                  {review.revisions_used}/{scope?.revision_limit || 8}{" "}
                  {text.rounds}
                </p>
              </div>
              <a
                className="inline-flex min-h-12 items-center gap-2 border border-[#d9b55a] px-5 text-xs uppercase tracking-[.16em] text-[#e7ca7e]"
                href={previewUrl}
                rel="noreferrer"
                target="_blank"
              >
                {text.preview}
                <ExternalLink size={14} />
              </a>
            </div>
            {!review.approved && !review.stale ? (
              <div className="mt-8 grid gap-7 md:grid-cols-2">
                <div>
                  <label className="text-xs uppercase tracking-[.16em] text-white/55">
                    {text.requestRevision}
                  </label>
                  <textarea
                    className="mt-3 min-h-36 w-full border border-white/15 bg-black/20 p-4 text-sm outline-none focus:border-[#d9b55a]"
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={text.revisionPlaceholder}
                    value={note}
                  />
                  <button
                    className="mt-3 inline-flex min-h-11 items-center gap-2 border border-white/20 px-4 text-xs uppercase tracking-[.14em] disabled:opacity-40"
                    disabled={busy || !note.trim()}
                    onClick={() =>
                      void act("revisions", { note }, text.sendRevision)
                    }
                    type="button"
                  >
                    <MessageSquareText size={14} />
                    {text.sendRevision}
                  </button>
                </div>
                <div>
                  <button
                    className="inline-flex min-h-12 items-center gap-2 border border-[#d9b55a] px-5 text-xs uppercase tracking-[.14em] text-[#e7ca7e] disabled:opacity-40"
                    disabled={busy}
                    onClick={() => void act("otp", {}, text.otp)}
                    type="button"
                  >
                    <Send size={14} />
                    {text.otp}
                  </button>
                  {review.otp ? (
                    <p className="mt-3 text-sm text-white/55">
                      {text.sent} {review.otp.destination} ({review.otp.channel}
                      )
                    </p>
                  ) : null}
                  <label className="mt-6 block text-xs uppercase tracking-[.16em] text-white/55">
                    {text.code}
                  </label>
                  <input
                    className="mt-3 min-h-12 w-full border border-white/15 bg-black/20 px-4 text-xl tracking-[.35em] outline-none focus:border-[#d9b55a]"
                    inputMode="numeric"
                    maxLength={6}
                    onChange={(event) =>
                      setCode(event.target.value.replace(/\D/g, ""))
                    }
                    value={code}
                  />
                  <button
                    className="mt-3 inline-flex min-h-12 items-center gap-2 bg-[#d9b55a] px-5 text-xs font-semibold uppercase tracking-[.14em] text-black disabled:opacity-40"
                    disabled={busy || code.length !== 6}
                    onClick={() => void act("approve", { code }, text.approved)}
                    type="button"
                  >
                    <KeyRound size={14} />
                    {text.approve}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {review.purpose === "scope" && !review.approved ? (
          <section className="mt-8 border border-white/12 p-5 md:p-8">
            <p className="text-sm text-white/60">
              {review.otp ? `${text.sent} ${review.otp.destination}` : text.otp}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                className="inline-flex min-h-12 items-center gap-2 border border-[#d9b55a] px-5 text-xs uppercase tracking-[.14em] text-[#e7ca7e]"
                disabled={busy}
                onClick={() => void act("otp", {}, text.otp)}
                type="button"
              >
                <Send size={14} />
                {text.otp}
              </button>
              <input
                className="min-h-12 border border-white/15 bg-black/20 px-4 tracking-[.3em]"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, ""))
                }
                placeholder={text.code}
                value={code}
              />
              <button
                className="min-h-12 bg-[#d9b55a] px-5 text-xs font-semibold uppercase tracking-[.14em] text-black disabled:opacity-40"
                disabled={busy || code.length !== 6}
                onClick={() => void act("approve", { code }, text.approved)}
                type="button"
              >
                {text.approve}
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
