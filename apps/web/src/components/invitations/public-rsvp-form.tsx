"use client";

import { Send } from "lucide-react";
import { useState } from "react";

import { env } from "@/lib/env";

type PublicRSVPFormProps = {
  embedded?: boolean;
  initialToken?: string;
  previewToken?: string;
  publicSlug: string;
};

function friendlyRsvpError(message?: string): string {
  if (!message) {
    return "RSVP gagal dikirim. Pastikan link tamu valid dan jumlah hadir sesuai.";
  }
  if (message.toLowerCase().includes("invalid rsvp token")) {
    return "Token tamu tidak valid atau link tamu sudah tidak aktif.";
  }
  if (message.toLowerCase().includes("not found")) {
    return "Undangan belum tersedia atau link preview sudah tidak valid.";
  }
  return message;
}

export function PublicRSVPForm({
  embedded = false,
  initialToken = "",
  previewToken = "",
  publicSlug,
}: PublicRSVPFormProps) {
  const [token] = useState(initialToken);
  const [status, setStatus] = useState("accepted");
  const [attendanceCount, setAttendanceCount] = useState("1");
  const [wishes, setWishes] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submitRSVP() {
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch(
        `${env.NEXT_PUBLIC_API_URL}/invitations/${publicSlug}/rsvp`,
        {
          body: JSON.stringify({
            attendance_count: Number(attendanceCount),
            preview: previewToken,
            rsvp_status: status,
            token: token.trim(),
            wishes,
          }),
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          method: "POST",
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as
          | { detail?: string; attendance_count?: string[] | string }
          | null;
        const attendanceError = Array.isArray(payload?.attendance_count)
          ? payload.attendance_count.join(" ")
          : payload?.attendance_count;
        setMessage(
          friendlyRsvpError(attendanceError ?? payload?.detail),
        );
        return;
      }
      setSubmitted(true);
      setMessage("RSVP terkirim. Terima kasih atas konfirmasinya.");
    } catch {
      setMessage("RSVP belum bisa dikirim. Coba beberapa saat lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  const shellClassName = embedded
    ? "mx-auto grid max-w-3xl gap-5 border border-current/20 bg-black/10 p-5 text-current backdrop-blur-[1px] md:p-8"
    : "mx-auto grid max-w-3xl gap-5 border border-white/12 bg-[#181815] p-5";
  const mutedLabelClassName = embedded
    ? "text-[0.6rem] uppercase tracking-[0.16em] opacity-55"
    : "text-[0.6rem] uppercase tracking-[0.16em] text-white/45";
  const controlClassName = embedded
    ? "min-h-11 border border-current/20 bg-black/10 px-3 text-sm text-current outline-none transition focus:border-[var(--color-gold)]"
    : "min-h-11 border border-white/15 bg-black/30 px-3 text-sm outline-none transition focus:border-[var(--color-gold)]";
  const textareaClassName = embedded
    ? "min-h-28 resize-y border border-current/20 bg-black/10 px-3 py-3 text-sm text-current outline-none transition focus:border-[var(--color-gold)]"
    : "min-h-28 resize-y border border-white/15 bg-black/30 px-3 py-3 text-sm outline-none transition focus:border-[var(--color-gold)]";

  const form = (
    <div className={shellClassName}>
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--color-gold)]">
            RSVP
          </p>
          <h2 className="mt-3 font-serif text-3xl">Konfirmasi kehadiran.</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-2">
            <span className={mutedLabelClassName}>
              Status
            </span>
            <select
              className={controlClassName}
              onChange={(event) => {
                setStatus(event.target.value);
                if (event.target.value === "declined") {
                  setAttendanceCount("0");
                }
              }}
              value={status}
            >
              <option value="accepted">Hadir</option>
              <option value="declined">Tidak hadir</option>
            </select>
          </label>
          <label className="grid gap-2">
            <span className={mutedLabelClassName}>
              Jumlah hadir
            </span>
            <input
              className={controlClassName}
              min={0}
              onChange={(event) => setAttendanceCount(event.target.value)}
              type="number"
              value={attendanceCount}
            />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className={mutedLabelClassName}>
              Ucapan
            </span>
            <textarea
              className={textareaClassName}
              onChange={(event) => setWishes(event.target.value)}
              value={wishes}
            />
          </label>
        </div>
        {message ? (
          <div className="border border-[#d5ad55]/40 bg-[#d5ad55]/10 p-4 text-sm leading-6 text-[#f4ddb0]">
            {message}
          </div>
        ) : null}
        <button
          className="inline-flex min-h-11 items-center justify-center gap-3 bg-[var(--color-gold)] px-4 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#17140d] transition hover:brightness-110 disabled:opacity-50"
          disabled={submitting || submitted || !token.trim()}
          onClick={() => void submitRSVP()}
          type="button"
        >
          <Send size={15} />
          {submitted ? "RSVP Terkirim" : submitting ? "Mengirim" : "Kirim RSVP"}
        </button>
      </div>
  );

  if (embedded) {
    return form;
  }

  return (
    <section className="bg-[#11100e] px-5 py-12 text-white">
      {form}
    </section>
  );
}
