"use client";

import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { consumeGrantFragment } from "@/lib/use-grant-fragment";

type ClientAccessFormProps =
  | { mode: "bootstrap"; token: string; grantId?: never }
  | { mode: "login"; grantId: string; token?: never };

type AccessResponse = {
  access_id?: string;
  csrf_token: string;
  must_change_pin: boolean;
  redirect_to: string;
};

async function responseMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      detail?: string;
      error?: { message?: string };
    };
    return payload.detail ?? payload.error?.message ?? "Akses ditolak.";
  } catch {
    return "Akses ditolak.";
  }
}

export function ClientAccessForm(props: ClientAccessFormProps) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [nextPin, setNextPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [csrfToken, setCsrfToken] = useState("");
  const [mustChangePin, setMustChangePin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loginUrl, setLoginUrl] = useState("");
  const [pinCreated, setPinCreated] = useState(false);

  async function authenticate() {
    setBusy(true);
    setError("");
    try {
      const endpoint =
        props.mode === "bootstrap"
          ? "/api/client/bootstrap"
          : `/api/client/login/${encodeURIComponent(props.grantId)}`;
      const response = await fetch(endpoint, {
        body: JSON.stringify(
          props.mode === "bootstrap" ? { pin, token: props.token } : { pin },
        ),
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(await responseMessage(response));
      }
      const payload = (await response.json()) as AccessResponse;
      if (props.mode === "bootstrap") {
        consumeGrantFragment();
      }
      const accessId =
        props.mode === "login" ? props.grantId : payload.access_id;

      if (!accessId) {
        throw new Error("Alamat login belum tersedia. Silahkan coba lagi");
      }

      setLoginUrl(
        new URL(
          `/client/login/${encodeURIComponent(accessId)}`,
          window.location.origin,
        ).href,
      );
      window.sessionStorage.setItem("niskala-client-csrf", payload.csrf_token);
      if (payload.access_id) {
        window.localStorage.setItem(
          "niskala-client-access-id",
          payload.access_id,
        );
      } else if (props.mode === "login") {
        window.localStorage.setItem("niskala-client-access-id", props.grantId);
      }
      setCsrfToken(payload.csrf_token);
      setMustChangePin(payload.must_change_pin);
      if (!payload.must_change_pin) {
        setPin("");
        setNextPin("");
        setConfirmPin("");
        setPinCreated(true);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Link atau PIN tidak dapat diverifikasi.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function changePin() {
    if (nextPin.length < 8 || nextPin.length > 128) {
      setError("PIN/passphrase baru harus berisi 8-128 karakter.");
      return;
    }
    if (nextPin !== confirmPin) {
      setError("Konfirmasi PIN/passphrase tidak sama.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/client/pin", {
        body: JSON.stringify({
          current_pin: pin,
          next_pin: nextPin,
        }),
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken,
        },
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(await responseMessage(response));
      }
      router.replace("/client/portal" as Route);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "PIN/passphrase tidak dapat diperbarui.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (pinCreated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-6 py-14 text-white">
        <section className="w-full max-w-lg border-white/12 bg-white/[0.025] p-7 md:p-10">
          <h1 className="font-serif text-4xl">PIN berhasil dibuat.</h1>

          <p className="mt-4 text-sm leading-7 text-white/70">
            Gunakan PIN baru kamu untuk masuk kembali sampai masa aktif undangan
            berakhir. PIN awal dari staff sudah tidak berlaku.
          </p>

          <label className="mt-6 block">
            <span className="text-xs uppercase tracking-[0.14em] text-white/60">
              Simpan link login ini
            </span>

            <input
              className="mt-2 w-full border border-white/15 bg-black/40 py-3 text-sm"
              onFocus={(event) => event.currentTarget.select()}
              readOnly
              type="text"
              value={loginUrl}
            />
          </label>

          <p className="mt-3 text-sm leading-6 text-white/60">
            Salink link ini atau simpan sebagai bookmark. Untuk masuk dari
            perangkat lain, buka link yang sama dan gunakan PIN baru kamu.
          </p>

          <button
            className="mt-6 min-h-12 w-full bg-[var(--color-gold)] px-5 text-xs  font-semibold uppercase tracking-[0.16em] text-black"
            onClick={() => {
              router.replace("/client/portal" as Route);
              router.refresh();
            }}
            type="button"
          >
            Lanjut ke Portal Tamu
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 py-14 text-white">
      <section className="w-full max-w-lg border border-white/12 bg-white/[0.025] p-7 md:p-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-gold)]/60 text-[var(--color-gold)]">
          {mustChangePin ? <ShieldCheck size={21} /> : <KeyRound size={21} />}
        </div>
        <p className="mt-8 text-[0.65rem] uppercase tracking-[0.28em] text-[var(--color-gold)]">
          Portal Tamu Client
        </p>
        <h1 className="mt-3 font-serif text-4xl">
          {mustChangePin ? "Buat PIN baru." : "Verifikasi akses."}
        </h1>
        <p className="mt-4 text-sm leading-7 text-white/60">
          {mustChangePin
            ? "Buat PIN/passphrase pribadi sepanjang 8-128 karakter. Setelah tersimpan, gunakan PIN ini untuk login berikutnya sampai undangan expired."
            : props.mode === "bootstrap"
              ? "Masukkan PIN awal dari staff untuk mengaktifkan akses kamu."
              : "Masukkan PIN pribadi yang kamu buat saat aktivasi. Jika aktivasi belum selesai, gunakan PIN awal untuk melanjutkan."}
        </p>

        <div className="mt-8 space-y-4">
          {!mustChangePin ? (
            <label className="block">
              <span className="text-xs uppercase tracking-[0.14em] text-white/55">
                PIN awal atau PIN client
              </span>
              <input
                autoComplete="current-password"
                className="mt-2 w-full border border-white/15 bg-black/40 px-4 py-3 outline-none focus:border-[var(--color-gold)]"
                onChange={(event) => setPin(event.target.value)}
                type="password"
                value={pin}
              />
            </label>
          ) : (
            <>
              <label className="block">
                <span className="text-xs uppercase tracking-[0.14em] text-white/55">
                  PIN/passphrase baru
                </span>
                <input
                  autoComplete="new-password"
                  className="mt-2 w-full border border-white/15 bg-black/40 px-4 py-3 outline-none focus:border-[var(--color-gold)]"
                  onChange={(event) => setNextPin(event.target.value)}
                  type="password"
                  value={nextPin}
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-[0.14em] text-white/55">
                  Konfirmasi PIN/passphrase
                </span>
                <input
                  autoComplete="new-password"
                  className="mt-2 w-full border border-white/15 bg-black/40 px-4 py-3 outline-none focus:border-[var(--color-gold)]"
                  onChange={(event) => setConfirmPin(event.target.value)}
                  type="password"
                  value={confirmPin}
                />
              </label>
            </>
          )}
        </div>

        {error ? (
          <p className="mt-5 border border-red-300/30 bg-red-300/10 p-3 text-sm text-red-100">
            {error}
          </p>
        ) : null}

        <button
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-3 bg-[var(--color-gold)] px-5 text-xs font-semibold uppercase tracking-[0.16em] text-black disabled:opacity-50"
          disabled={busy || (!mustChangePin && !pin)}
          onClick={() => void (mustChangePin ? changePin() : authenticate())}
          type="button"
        >
          {busy ? <Loader2 className="animate-spin" size={16} /> : null}
          {mustChangePin ? "Simpan PIN Baru" : "Masuk Portal"}
        </button>
      </section>
    </main>
  );
}
