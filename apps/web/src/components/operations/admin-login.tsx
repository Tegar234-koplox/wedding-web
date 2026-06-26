"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { env } from "@/lib/env";

type StaffSessionUser = {
  username: string;
  email: string;
  role: string;
  display_name: string;
};

async function csrfToken(): Promise<string> {
  const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/auth/csrf`, {
    cache: "no-store",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`CSRF request failed with ${response.status}`);
  }
  const payload = (await response.json()) as { csrfToken: string };
  return payload.csrfToken;
}

async function staffLogin(username: string, password: string): Promise<StaffSessionUser> {
  const token = await csrfToken();
  const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/auth/login`, {
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
      const payload = (await response.json()) as { detail?: string };
      detail = payload.detail ?? detail;
    } catch {
      // Keep the status text when the backend returns a non-JSON error.
    }
    throw new Error(detail);
  }

  const payload = (await response.json()) as { user: StaffSessionUser };
  return payload.user;
}

export function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await staffLogin(username, password);
      router.replace("/admin");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Login staff tidak dapat diproses.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl border border-white/12 bg-[#181815] p-6 md:p-8">
      <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--color-gold)]">
        Staff session
      </p>
      <h2 className="mt-5 font-serif text-4xl">Login staff.</h2>
      <p className="mt-4 text-sm leading-6 text-white/55">
        Masuk dengan akun staff Django untuk membuka dashboard operasional.
      </p>

      {error ? (
        <div className="mt-6 border border-[#d5ad55]/40 bg-[#d5ad55]/10 p-4 text-sm leading-6 text-[#f4ddb0]">
          {error}
        </div>
      ) : null}

      <form className="mt-7 grid gap-4" onSubmit={submitLogin}>
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
        <button
          className="inline-flex min-h-12 items-center justify-center gap-3 bg-[var(--color-gold)] px-4 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#17140d] transition hover:brightness-110 disabled:opacity-50"
          disabled={submitting}
          type="submit"
        >
          <LogIn size={16} />
          {submitting ? "Memproses" : "Masuk"}
        </button>
      </form>

      <Link
        className="mt-6 inline-flex text-xs uppercase tracking-[0.16em] text-white/45 transition hover:text-[var(--color-gold)]"
        href="/admin"
      >
        Kembali ke admin
      </Link>
    </div>
  );
}
