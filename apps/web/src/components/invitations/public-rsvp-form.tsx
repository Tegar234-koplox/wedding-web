"use client";

import { Send } from "lucide-react";
import { useState } from "react";

import { env } from "@/lib/env";

type PublicRSVPFormProps = {
  initialToken?: string;
  publicSlug: string;
};

export function PublicRSVPForm({ initialToken = "", publicSlug }: PublicRSVPFormProps) {
  const [token, setToken] = useState(initialToken);
  const [status, setStatus] = useState("accepted");
  const [attendanceCount, setAttendanceCount] = useState("1");
  const [wishes, setWishes] = useState("");
  const [message, setMessage] = useState("");
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
        setMessage("RSVP gagal dikirim. Pastikan link tamu valid dan jumlah hadir sesuai.");
        return;
      }
      setMessage("RSVP tersimpan. Terima kasih atas konfirmasinya.");
    } catch {
      setMessage("RSVP belum bisa dikirim. Coba beberapa saat lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="bg-[#11100e] px-5 py-12 text-white">
      <div className="mx-auto grid max-w-3xl gap-5 border border-white/12 bg-[#181815] p-5">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--color-gold)]">
            RSVP
          </p>
          <h2 className="mt-3 font-serif text-3xl">Konfirmasi kehadiran.</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-2 md:col-span-2">
            <span className="text-[0.6rem] uppercase tracking-[0.16em] text-white/45">
              Token tamu
            </span>
            <input
              className="min-h-11 border border-white/15 bg-black/30 px-3 text-sm outline-none transition focus:border-[var(--color-gold)]"
              onChange={(event) => setToken(event.target.value)}
              placeholder="Token dari link undangan personal"
              value={token}
            />
          </label>
          <label className="grid gap-2">
            <span className="text-[0.6rem] uppercase tracking-[0.16em] text-white/45">
              Status
            </span>
            <select
              className="min-h-11 border border-white/15 bg-black/30 px-3 text-sm outline-none transition focus:border-[var(--color-gold)]"
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
            <span className="text-[0.6rem] uppercase tracking-[0.16em] text-white/45">
              Jumlah hadir
            </span>
            <input
              className="min-h-11 border border-white/15 bg-black/30 px-3 text-sm outline-none transition focus:border-[var(--color-gold)]"
              min={0}
              onChange={(event) => setAttendanceCount(event.target.value)}
              type="number"
              value={attendanceCount}
            />
          </label>
          <label className="grid gap-2 md:col-span-2">
            <span className="text-[0.6rem] uppercase tracking-[0.16em] text-white/45">
              Ucapan
            </span>
            <textarea
              className="min-h-28 resize-y border border-white/15 bg-black/30 px-3 py-3 text-sm outline-none transition focus:border-[var(--color-gold)]"
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
          disabled={submitting || !token.trim()}
          onClick={() => void submitRSVP()}
          type="button"
        >
          <Send size={15} />
          {submitting ? "Mengirim" : "Kirim RSVP"}
        </button>
      </div>
    </section>
  );
}
