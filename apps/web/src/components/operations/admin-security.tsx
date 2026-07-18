"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { staffFetch, type StaffSession } from "@/components/operations/staff-api";
import {
  NetworkAwarePreloader,
  NiskalaPreloader,
  type PreloaderState,
} from "@/components/site/niskala-preloader";

type EnrollmentPayload = {
  otpauth_uri: string;
  qr_data_url: string;
};

type ConfirmationPayload = {
  mfa_enrolled: boolean;
  recovery_codes: string[];
};

export function AdminSecurity() {
  const [session, setSession] = useState<StaffSession | null>(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [enrollment, setEnrollment] = useState<EnrollmentPayload | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Extract<PreloaderState, "success" | "error"> | null>(
    null,
  );
  const [sessionLoading, setSessionLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void staffFetch<StaffSession>("/auth/me")
      .then((payload) => {
        if (!cancelled) setSession(payload);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Sesi staff gagal dimuat.");
          setResult("error");
        }
      })
      .finally(() => {
        if (!cancelled) setSessionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function startEnrollment() {
    setBusy(true);
    setMessage("");
    setResult(null);
    try {
      const payload = await staffFetch<EnrollmentPayload>("/auth/mfa/enroll", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setEnrollment(payload);
      setPassword("");
      setMessage("QR authenticator berhasil disiapkan.");
      setResult("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Enrollment MFA gagal.");
      setResult("error");
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnrollment() {
    setBusy(true);
    setMessage("");
    setResult(null);
    try {
      const payload = await staffFetch<ConfirmationPayload>("/auth/mfa/confirm", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      setRecoveryCodes(payload.recovery_codes);
      setEnrollment(null);
      setCode("");
      setSession((current) =>
        current ? { ...current, user: { ...current.user, mfa_enrolled: true } } : current,
      );
      setMessage("MFA aktif. Simpan recovery code di password manager.");
      setResult("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Konfirmasi MFA gagal.");
      setResult("error");
    } finally {
      setBusy(false);
    }
  }

  async function reauthenticate() {
    setBusy(true);
    setMessage("");
    setResult(null);
    try {
      await staffFetch<{ ok: boolean }>("/auth/reauth", {
        method: "POST",
        body: JSON.stringify({ password, code }),
      });
      setPassword("");
      setCode("");
      setMessage("Verifikasi ulang berhasil. Aksi sensitif tersedia selama 30 menit.");
      setResult("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Verifikasi ulang gagal.");
      setResult("error");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "mt-2 w-full border border-white/15 bg-[#11110f] px-4 py-3 text-sm text-white outline-none focus:border-[var(--color-gold)]";
  const buttonClass =
    "mt-5 w-full border border-[var(--color-gold)] bg-[var(--color-gold)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-black disabled:opacity-50";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {sessionLoading ? (
        <div className="lg:col-span-2">
          <NetworkAwarePreloader compact context="refresh" />
        </div>
      ) : null}
      <section className="border border-white/12 bg-[#181815] p-6 md:p-8">
        <p className="text-[0.62rem] uppercase tracking-[0.2em] text-[var(--color-gold)]">
          Multi-factor authentication
        </p>
        <h2 className="mt-4 font-serif text-3xl">Authenticator staff.</h2>
        <p className="mt-4 text-sm leading-6 text-white/58">
          Status: {session?.user.mfa_enrolled ? "Aktif" : "Belum aktif"}
        </p>

        {!session?.user.mfa_enrolled && !enrollment ? (
          <>
            <label className="mt-7 block text-xs uppercase tracking-[0.14em] text-white/55">
              Password saat ini
              <input
                className={inputClass}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </label>
            <button
              className={buttonClass}
              disabled={busy || !password}
              onClick={() => void startEnrollment()}
              type="button"
            >
              Aktifkan MFA
            </button>
          </>
        ) : null}

        {enrollment ? (
          <div className="mt-7">
            <Image
              alt="QR authenticator Niskala"
              className="bg-white p-3"
              height={220}
              src={enrollment.qr_data_url}
              unoptimized
              width={220}
            />
            <p className="mt-4 break-all text-xs leading-5 text-white/45">
              {enrollment.otpauth_uri}
            </p>
            <label className="mt-5 block text-xs uppercase tracking-[0.14em] text-white/55">
              Kode 6 digit
              <input
                autoComplete="one-time-code"
                className={inputClass}
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setCode(event.target.value)}
                value={code}
              />
            </label>
            <button
              className={buttonClass}
              disabled={busy || code.length !== 6}
              onClick={() => void confirmEnrollment()}
              type="button"
            >
              Konfirmasi MFA
            </button>
          </div>
        ) : null}
      </section>

      <section className="border border-white/12 bg-[#181815] p-6 md:p-8">
        <p className="text-[0.62rem] uppercase tracking-[0.2em] text-[var(--color-gold)]">
          Step-up verification
        </p>
        <h2 className="mt-4 font-serif text-3xl">Aksi sensitif.</h2>
        <p className="mt-4 text-sm leading-6 text-white/58">
          Verifikasi ulang sebelum publish, arsip, konfirmasi pembayaran, atau perubahan
          data operasional penting.
        </p>
        {session?.user.mfa_enrolled ? (
          <>
            <label className="mt-7 block text-xs uppercase tracking-[0.14em] text-white/55">
              Password saat ini
              <input
                className={inputClass}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </label>
            <label className="mt-5 block text-xs uppercase tracking-[0.14em] text-white/55">
              Kode authenticator atau recovery code
              <input
                className={inputClass}
                onChange={(event) => setCode(event.target.value)}
                value={code}
              />
            </label>
            <button
              className={buttonClass}
              disabled={busy || !password || !code}
              onClick={() => void reauthenticate()}
              type="button"
            >
              Verifikasi ulang
            </button>
          </>
        ) : (
          <p className="mt-7 border border-amber-400/30 bg-amber-400/8 p-4 text-sm text-amber-100">
            Aktifkan MFA terlebih dahulu.
          </p>
        )}
      </section>

      {busy ? (
        <div className="lg:col-span-2">
          <NetworkAwarePreloader compact context="action" />
        </div>
      ) : null}
      {message && result ? (
        <div className="lg:col-span-2">
          <NiskalaPreloader compact description={message} state={result} />
        </div>
      ) : null}

      {recoveryCodes.length ? (
        <section className="border border-[var(--color-gold)] bg-[#181815] p-6 lg:col-span-2">
          <h2 className="font-serif text-2xl">Recovery codes.</h2>
          <p className="mt-3 text-sm text-white/58">
            Kode hanya ditampilkan sekali. Setiap kode hanya dapat digunakan satu kali.
          </p>
          <pre className="mt-5 overflow-x-auto border border-white/12 bg-black/25 p-5 text-sm leading-7">
            {recoveryCodes.join("\n")}
          </pre>
        </section>
      ) : null}
    </div>
  );
}
