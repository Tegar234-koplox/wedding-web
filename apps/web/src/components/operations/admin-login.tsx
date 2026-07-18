"use client";

import { LogIn, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

import {
  NetworkAwarePreloader,
  NiskalaPreloader,
} from "@/components/site/niskala-preloader";
import { staffApiPath } from "@/lib/api/staff-client";

type StaffSessionUser = {
  username: string;
  email: string;
  role: string;
  display_name: string;
  mfa_enrolled: boolean;
};

type StaffLoginResult =
  | { user: StaffSessionUser; mfa_required?: false }
  | {
      challenge: string;
      enrollment_required: boolean;
      mfa_required: true;
    };

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
        "Request login terlalu lama. Layanan staff belum merespons.",
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
    throw new Error(`CSRF backend gagal (${response.status}).`);
  }
  const payload = (await response.json()) as { csrfToken: string };
  return payload.csrfToken;
}

async function staffLogin(username: string, password: string): Promise<StaffLoginResult> {
  const token = await csrfToken();
  const response = await fetchWithTimeout(staffApiPath("/auth/login"), {
    body: JSON.stringify({ password, username }),
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRFToken": token,
    },
    method: "POST",
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const payload = (await response.json()) as {
        detail?: string;
        error?: { message?: string };
      };
      detail = payload.detail ?? payload.error?.message ?? detail;
    } catch {
      // Keep status text for non-JSON backend errors.
    }
    throw new Error(`Login ditolak (${response.status}): ${detail}`);
  }

  return (await response.json()) as StaffLoginResult;
}

async function staffMfaLogin(challenge: string, code: string): Promise<StaffSessionUser> {
  const token = await csrfToken();
  const response = await fetchWithTimeout(staffApiPath("/auth/login/mfa"), {
    body: JSON.stringify({ challenge, code }),
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRFToken": token,
    },
    method: "POST",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      detail?: string;
      error?: { message?: string };
    };
    throw new Error(
      `Verifikasi ditolak (${response.status}): ${payload.detail ?? payload.error?.message ?? response.statusText}`,
    );
  }

  const payload = (await response.json()) as { user: StaffSessionUser };
  return payload.user;
}

export function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mfaChallenge, setMfaChallenge] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    let navigating = false;
    try {
      if (mfaChallenge) {
        setStatus("Memverifikasi kode keamanan...");
        await staffMfaLogin(mfaChallenge, mfaCode);
      } else {
        setStatus("Memverifikasi akun staff...");
        const result = await staffLogin(username, password);
        if (result.mfa_required) {
          if (result.enrollment_required) {
            throw new Error(
              "MFA wajib tetapi akun belum terdaftar. Nonaktifkan flag sementara dan lakukan enrollment staff.",
            );
          }
          setMfaChallenge(result.challenge);
          setPassword("");
          setStatus("Masukkan kode authenticator atau recovery code.");
          return;
        }
      }
      setStaffGateCookie();
      setStatus("Login berhasil. Membuka dashboard...");
      navigating = true;
      router.replace("/admin");
      router.refresh();
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
      <h2 className="mt-5 font-serif text-4xl">Login staff.</h2>
      <p className="mt-4 text-sm leading-6 text-white/55">
        {mfaChallenge
          ? "Selesaikan verifikasi kedua untuk membuat session staff."
          : "Masuk dengan akun staff untuk membuka dashboard operasional."}
      </p>

      {error ? (
        <div className="mt-6">
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
        <div className="mt-6 border border-white/12 bg-black/25 p-4 text-sm leading-6 text-white/60">
          {status}
        </div>
      ) : null}

      <form className="mt-7 grid gap-4" onSubmit={submitLogin}>
        {mfaChallenge ? (
          <label className="grid gap-2">
            <span className="text-[0.6rem] uppercase tracking-[0.16em] text-white/40">
              Kode authenticator atau recovery
            </span>
            <input
              autoComplete="one-time-code"
              autoFocus
              className="min-h-12 border border-white/15 bg-black/30 px-3 text-sm outline-none transition focus:border-[var(--color-gold)]"
              inputMode="numeric"
              onChange={(event) => setMfaCode(event.target.value)}
              required
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
          {mfaChallenge ? <ShieldCheck size={16} /> : <LogIn size={16} />}
          {submitting ? "Memproses" : mfaChallenge ? "Verifikasi" : "Masuk"}
        </button>
        {mfaChallenge ? (
          <button
            className="min-h-11 border border-white/12 px-4 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-white/55"
            onClick={() => {
              setMfaChallenge("");
              setMfaCode("");
              setStatus("");
            }}
            type="button"
          >
            Kembali ke password
          </button>
        ) : null}
      </form>
    </div>
  );
}
