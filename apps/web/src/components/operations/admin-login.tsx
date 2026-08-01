"use client";

import { Check, Copy, LogIn, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";
import type { FormEvent } from "react";
import { useState } from "react";

import {
  NetworkAwarePreloader,
  NiskalaPreloader,
} from "@/components/site/niskala-preloader";
import { staffApiPath } from "@/lib/api/staff-client";
import {
  isStaffRole,
  type StaffSessionUser,
} from "@/components/operations/staff-api";

type StaffLoginResult =
  | { user: StaffSessionUser; mfa_required?: false }
  | {
      challenge: string;
      enrollment_required: boolean;
      mfa_required: true;
    };

type MfaEnrollment = {
  otpauth_uri: string;
  qr_data_url: string;
};

type MfaConfirmation = {
  user: StaffSessionUser;
  recovery_codes: string[];
};

type LoginStage = "credentials" | "mfa" | "enrollment" | "recovery";

const requestTimeoutMs = 15_000;
const staffGateCookie = "niskala_staff_gate";

function staffGateCookieAttributes(maxAge: number) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  return `Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

function setStaffGateCookie() {
  document.cookie = `${staffGateCookie}=1; ${staffGateCookieAttributes(43200)}`;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === "AbortError") {
      throw new Error(
        "Permintaan login terlalu lama. Silakan coba beberapa saat lagi.",
      );
    }
    throw new Error("Layanan staff tidak dapat dihubungi. Silakan coba lagi.");
  } finally {
    window.clearTimeout(timeout);
  }
}

async function csrfToken(): Promise<string> {
  const response = await fetchWithTimeout(staffApiPath("/auth/csrf"), {
    cache: "no-store",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error("Login staff tidak dapat diproses. Silakan coba lagi.");
  }
  const payload = (await response.json().catch(() => null)) as {
    csrfToken?: unknown;
  } | null;
  if (typeof payload?.csrfToken !== "string" || !payload.csrfToken) {
    throw new Error("Login staff tidak dapat diproses. Silakan coba lagi.");
  }
  return payload.csrfToken;
}

async function postStaffAuth<T>(
  path: string,
  body: Record<string, string>,
  rejectionMessage: string,
): Promise<T> {
  const token = await csrfToken();
  const response = await fetchWithTimeout(staffApiPath(path), {
    body: JSON.stringify(body),
    cache: "no-store",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRFToken": token,
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(rejectionMessage);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error("Respons layanan staff tidak valid. Silakan coba lagi.");
  }
}

async function staffLogin(
  username: string,
  password: string,
): Promise<StaffLoginResult> {
  const payload = await postStaffAuth<unknown>(
    "/auth/login",
    { password, username },
    "Login tidak berhasil. Periksa kembali data akun Anda.",
  );
  if (!isRecord(payload)) {
    throw new Error("Respons login staff tidak valid. Silakan coba lagi.");
  }
  if (
    payload.mfa_required === true &&
    typeof payload.challenge === "string" &&
    payload.challenge &&
    typeof payload.enrollment_required === "boolean"
  ) {
    return {
      challenge: payload.challenge,
      enrollment_required: payload.enrollment_required,
      mfa_required: true,
    };
  }
  if (isStaffSessionUser(payload.user)) {
    return { user: payload.user };
  }
  throw new Error("Respons login staff tidak valid. Silakan coba lagi.");
}

async function staffMfaLogin(
  challenge: string,
  code: string,
): Promise<StaffSessionUser> {
  const payload = await postStaffAuth<{ user: StaffSessionUser }>(
    "/auth/login/mfa",
    { challenge, code },
    "Kode keamanan tidak dapat diverifikasi.",
  );
  if (!isStaffSessionUser(payload.user)) {
    throw new Error("Respons verifikasi MFA tidak valid. Silakan coba lagi.");
  }
  return payload.user;
}

async function startMfaEnrollment(challenge: string): Promise<MfaEnrollment> {
  const payload = await postStaffAuth<MfaEnrollment>(
    "/auth/login/mfa/enroll",
    { challenge },
    "Pendaftaran authenticator tidak dapat dimulai. Silakan login kembali.",
  );
  if (
    typeof payload.otpauth_uri !== "string" ||
    !payload.otpauth_uri.startsWith("otpauth://") ||
    typeof payload.qr_data_url !== "string"
  ) {
    throw new Error("Data authenticator tidak valid. Silakan login kembali.");
  }
  return payload;
}

async function confirmMfaEnrollment(
  challenge: string,
  code: string,
): Promise<MfaConfirmation> {
  const payload = await postStaffAuth<MfaConfirmation>(
    "/auth/login/mfa/confirm",
    { challenge, code },
    "Kode authenticator tidak dapat diverifikasi.",
  );
  if (
    !isStaffSessionUser(payload.user) ||
    !Array.isArray(payload.recovery_codes) ||
    payload.recovery_codes.length === 0 ||
    payload.recovery_codes.some((item) => typeof item !== "string" || !item)
  ) {
    throw new Error("Respons aktivasi MFA tidak valid. Silakan login kembali.");
  }
  return payload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStaffSessionUser(value: unknown): value is StaffSessionUser {
  return (
    isRecord(value) &&
    typeof value.username === "string" &&
    typeof value.email === "string" &&
    typeof value.role === "string" &&
    isStaffRole(value.staff_role) &&
    typeof value.display_name === "string" &&
    typeof value.mfa_enrolled === "boolean"
  );
}

function safeQrDataUrl(value: string): string | null {
  if (
    value.length > 1024 * 1024 ||
    !/^data:image\/png;base64,[a-zA-Z0-9+/=\r\n]+$/.test(value)
  ) {
    return null;
  }
  return value;
}

export function AdminLogin() {
  const router = useRouter();
  const [stage, setStage] = useState<LoginStage>("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mfaChallenge, setMfaChallenge] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const qrDataUrl = enrollment ? safeQrDataUrl(enrollment.qr_data_url) : null;

  function navigateToDashboard() {
    setStaffGateCookie();
    setUsername("");
    setPassword("");
    setMfaChallenge("");
    setMfaCode("");
    setEnrollment(null);
    setRecoveryCodes([]);
    setStatus("Login berhasil. Membuka dashboard...");
    router.replace("/admin");
    router.refresh();
  }

  function returnToPassword() {
    setStage("credentials");
    setPassword("");
    setMfaChallenge("");
    setMfaCode("");
    setEnrollment(null);
    setRecoveryCodes([]);
    setError("");
    setStatus("");
  }

  async function copyText(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(successMessage);
      setError("");
    } catch {
      setStatus("");
      setError("Tidak dapat menyalin otomatis. Salin teks secara manual.");
    }
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stage === "recovery") {
      return;
    }
    setSubmitting(true);
    setError("");
    setStatus("");
    let navigating = false;
    try {
      if (stage === "mfa") {
        setStatus("Memverifikasi kode keamanan...");
        await staffMfaLogin(mfaChallenge, mfaCode.trim());
        navigating = true;
        navigateToDashboard();
        return;
      }

      if (stage === "enrollment") {
        setStatus("Mengaktifkan authenticator...");
        const result = await confirmMfaEnrollment(mfaChallenge, mfaCode.trim());
        setUsername("");
        setPassword("");
        setMfaChallenge("");
        setMfaCode("");
        setEnrollment(null);
        setRecoveryCodes(result.recovery_codes);
        setStage("recovery");
        setStatus("");
        return;
      }

      setStatus("Memverifikasi akun staff...");
      const result = await staffLogin(username, password);
      if (result.mfa_required) {
        setPassword("");
        if (result.enrollment_required) {
          setStatus("Menyiapkan authenticator...");
          const nextEnrollment = await startMfaEnrollment(result.challenge);
          setMfaChallenge(result.challenge);
          setEnrollment(nextEnrollment);
          setMfaCode("");
          setStage("enrollment");
          setStatus(
            "Pindai QR dengan aplikasi authenticator, lalu masukkan kodenya.",
          );
          return;
        }
        setMfaChallenge(result.challenge);
        setMfaCode("");
        setStage("mfa");
        setStatus("Masukkan kode authenticator atau recovery code.");
        return;
      }

      navigating = true;
      navigateToDashboard();
    } catch (caught) {
      setStatus("");
      setError(
        caught instanceof Error
          ? caught.message
          : "Login staff tidak dapat diproses.",
      );
    } finally {
      if (!navigating) {
        setSubmitting(false);
      }
    }
  }

  return (
    <div className="mx-auto max-w-xl border border-white/12 bg-[#181815] p-6 md:p-8">
      <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--color-gold)]">
        Staff session
      </p>
      <h2 className="mt-5 font-serif text-4xl">
        {stage === "enrollment"
          ? "Aktifkan MFA."
          : stage === "recovery"
            ? "Simpan recovery code."
            : "Login staff."}
      </h2>
      <p className="mt-4 text-sm leading-6 text-white/55">
        {stage === "enrollment"
          ? "MFA wajib untuk akun staff. Secret ini hanya ditampilkan selama proses aktivasi."
          : stage === "recovery"
            ? "Kode berikut hanya ditampilkan sekali. Simpan semuanya di password manager sebelum melanjutkan."
            : stage === "mfa"
              ? "Selesaikan verifikasi kedua untuk membuat session staff."
              : "Masuk dengan akun staff untuk membuka dashboard operasional."}
      </p>

      {error ? (
        <div className="mt-6" role="alert">
          <NiskalaPreloader compact description={error} state="error" />
        </div>
      ) : null}
      {submitting ? (
        <div className="mt-6">
          <NetworkAwarePreloader
            compact
            context="login"
            description={status || undefined}
          />
        </div>
      ) : status ? (
        <div
          aria-live="polite"
          className="mt-6 border border-white/12 bg-black/25 p-4 text-sm leading-6 text-white/60"
        >
          {status}
        </div>
      ) : null}

      {stage === "enrollment" && enrollment ? (
        <div className="mt-7 grid gap-5">
          {qrDataUrl ? (
            <div className="mx-auto border border-white/15 bg-white p-3">
              {/* A data URL must stay in this component instead of being preloaded by next/image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="QR aktivasi authenticator"
                className="h-56 w-56"
                height={224}
                src={qrDataUrl}
                width={224}
              />
            </div>
          ) : null}
          <div className="grid gap-2">
            <span className="text-[0.6rem] uppercase tracking-[0.16em] text-white/40">
              Setup key manual
            </span>
            <code className="break-all border border-white/12 bg-black/30 p-3 text-xs leading-5 text-white/65">
              {enrollment.otpauth_uri}
            </code>
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 border border-white/12 px-3 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-white/60"
              onClick={() =>
                void copyText(
                  enrollment.otpauth_uri,
                  "Setup key disalin. Jangan bagikan kepada siapa pun.",
                )
              }
              type="button"
            >
              <Copy size={14} /> Salin setup key
            </button>
          </div>
        </div>
      ) : null}

      {stage === "recovery" ? (
        <div className="mt-7 grid gap-5">
          <pre
            aria-label="Recovery codes"
            className="overflow-x-auto border border-[var(--color-gold)]/45 bg-black/35 p-4 text-sm leading-7 text-white/80"
          >
            {recoveryCodes.join("\n")}
          </pre>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 border border-white/12 px-3 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-white/65"
            onClick={() =>
              void copyText(
                recoveryCodes.join("\n"),
                "Recovery codes disalin. Simpan di password manager.",
              )
            }
            type="button"
          >
            <Copy size={14} /> Salin semua kode
          </button>
          <button
            className="inline-flex min-h-12 items-center justify-center gap-3 bg-[var(--color-gold)] px-4 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#17140d] transition hover:brightness-110"
            onClick={navigateToDashboard}
            type="button"
          >
            <Check size={16} /> Sudah disimpan, lanjut
          </button>
        </div>
      ) : (
        <form className="mt-7 grid gap-4" onSubmit={submitLogin}>
          {stage === "mfa" || stage === "enrollment" ? (
            <label className="grid gap-2">
              <span className="text-[0.6rem] uppercase tracking-[0.16em] text-white/40">
                {stage === "enrollment"
                  ? "Kode authenticator"
                  : "Kode authenticator atau recovery"}
              </span>
              <input
                autoComplete="one-time-code"
                autoFocus
                className="min-h-12 border border-white/15 bg-black/30 px-3 text-sm outline-none transition focus:border-[var(--color-gold)]"
                inputMode={stage === "enrollment" ? "numeric" : "text"}
                onChange={(event) => setMfaCode(event.target.value)}
                required
                spellCheck={false}
                value={mfaCode}
              />
            </label>
          ) : (
            <>
              <label className="grid gap-2">
                <span className="text-[0.6rem] uppercase tracking-[0.16em] text-white/40">
                  Username atau email
                </span>
                <input
                  autoComplete="username"
                  className="min-h-12 border border-white/15 bg-black/30 px-3 text-sm outline-none transition focus:border-[var(--color-gold)]"
                  onChange={(event) => setUsername(event.target.value)}
                  required
                  value={username}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-[0.6rem] uppercase tracking-[0.16em] text-white/40">
                  Password
                </span>
                <input
                  autoComplete="current-password"
                  className="min-h-12 border border-white/15 bg-black/30 px-3 text-sm outline-none transition focus:border-[var(--color-gold)]"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </label>
            </>
          )}
          <button
            className="inline-flex min-h-12 items-center justify-center gap-3 bg-[var(--color-gold)] px-4 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#17140d] transition hover:brightness-110 disabled:opacity-50"
            disabled={submitting}
            type="submit"
          >
            {stage === "credentials" ? (
              <LogIn size={16} />
            ) : (
              <ShieldCheck size={16} />
            )}
            {submitting
              ? "Memproses"
              : stage === "enrollment"
                ? "Aktifkan MFA"
                : stage === "mfa"
                  ? "Verifikasi"
                  : "Masuk"}
          </button>
          {stage === "mfa" || stage === "enrollment" ? (
            <button
              className="min-h-11 border border-white/12 px-4 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-white/55"
              onClick={returnToPassword}
              type="button"
            >
              Kembali ke password
            </button>
          ) : null}
        </form>
      )}
    </div>
  );
}
