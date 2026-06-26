"use client";

import { CheckCircle2, RefreshCw, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

type ClientOrder = {
  reference: string;
  status: string;
  theme_slug: string | null;
  package_code: string | null;
  invitation_slug: string | null;
  client_name: string;
  event_date: string | null;
  total_amount: string;
  currency: string;
  updated_at: string;
};

type ClientInvitation = {
  public_slug: string;
  theme_slug: string;
  package_code: string | null;
  status: string;
  approval_status: string;
  default_locale: string;
  content: {
    couple?: {
      partnerOne?: string;
      partnerTwo?: string;
    };
    event?: {
      dateLabel?: string;
      venue?: string;
    };
  };
  updated_at: string;
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

async function clientFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const unsafe = !["GET", "HEAD", "OPTIONS"].includes(method);
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };

  if (unsafe) {
    headers["Content-Type"] = "application/json";
    headers["X-CSRFToken"] = await csrfToken();
  }

  const response = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const label =
      response.status === 401 || response.status === 403
        ? "Session client tidak aktif"
        : response.status >= 500
          ? "Backend client API sedang error"
          : "Request client API ditolak";
    throw new Error(`${label} (${response.status})`);
  }

  return response.json() as Promise<T>;
}

function formatCurrency(value: string): string {
  return new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(Number(value));
}

export function ClientOperations() {
  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [invitations, setInvitations] = useState<ClientInvitation[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState("");
  const [error, setError] = useState("");

  const selectedInvitation = useMemo(
    () =>
      invitations.find((invitation) => invitation.public_slug === selectedSlug) ??
      invitations[0],
    [invitations, selectedSlug],
  );

  const selectedOrder = useMemo(
    () =>
      orders.find(
        (order) => order.invitation_slug === selectedInvitation?.public_slug,
      ) ?? orders[0],
    [orders, selectedInvitation],
  );

  const loadClientData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextOrders, nextInvitations] = await Promise.all([
        clientFetch<ClientOrder[]>("/client/orders"),
        clientFetch<ClientInvitation[]>("/client/invitations"),
      ]);
      setOrders(nextOrders);
      setInvitations(nextInvitations);
      setSelectedSlug((current) => current || nextInvitations[0]?.public_slug || "");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Client dashboard tidak dapat dimuat.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadClientData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadClientData]);

  async function runInvitationAction(action: "submit-revision" | "approve-publish") {
    if (!selectedInvitation) {
      return;
    }
    setSavingAction(action);
    setError("");
    try {
      await clientFetch(
        `/client/invitations/${selectedInvitation.public_slug}/${action}`,
        { method: "POST" },
      );
      const nextInvitations = await clientFetch<ClientInvitation[]>(
        "/client/invitations",
      );
      setInvitations(nextInvitations);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Aksi invitation gagal disimpan.",
      );
    } finally {
      setSavingAction("");
    }
  }

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--color-gold)]">
            Live Client Data
          </p>
          <p className="mt-2 text-sm text-white/55">
            Menampilkan order dan invitation yang terhubung ke akun client.
          </p>
        </div>
        <button
          className="inline-flex min-h-11 items-center gap-3 border border-white/15 px-4 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white/70 transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
          disabled={loading}
          onClick={() => void loadClientData()}
          type="button"
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="border border-[#d5ad55]/40 bg-[#d5ad55]/10 p-5 text-sm leading-6 text-[#f4ddb0]">
          {error}. Login sebagai client yang memiliki order/invitation, lalu refresh.
        </div>
      ) : null}

      <div className="grid gap-px bg-white/12 md:grid-cols-4">
        {[
          ["Orders", orders.length],
          ["Invitations", invitations.length],
          ["Draft", invitations.filter((item) => item.status === "draft").length],
          [
            "Approved",
            invitations.filter(
              (item) => item.approval_status === "approved_for_publish",
            ).length,
          ],
        ].map(([label, value]) => (
          <article className="bg-[#181815] p-5" key={label}>
            <p className="text-[0.6rem] uppercase tracking-[0.18em] text-white/45">
              {label}
            </p>
            <p className="mt-5 font-serif text-4xl">{value}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-8 xl:grid-cols-[1fr_24rem]">
        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="font-serif text-4xl">Invitation drafts</h2>
            <span className="text-xs uppercase tracking-[0.16em] text-white/45">
              {invitations.length} active
            </span>
          </div>
          <div className="grid gap-px bg-white/12">
            {invitations.map((invitation) => (
              <button
                className={cn(
                  "grid gap-3 bg-[#181815] p-5 text-left transition hover:bg-white/5 md:grid-cols-[1fr_auto]",
                  selectedInvitation?.public_slug === invitation.public_slug &&
                    "bg-[#d5ad55]/10",
                )}
                key={invitation.public_slug}
                onClick={() => setSelectedSlug(invitation.public_slug)}
                type="button"
              >
                <span>
                  <span className="block font-serif text-3xl">
                    {invitation.content.couple?.partnerOne ?? "Invitation"} &{" "}
                    {invitation.content.couple?.partnerTwo ?? "Draft"}
                  </span>
                  <span className="mt-3 block text-sm text-white/55">
                    {invitation.theme_slug} / {invitation.package_code ?? "package unset"}
                  </span>
                </span>
                <span className="text-[0.62rem] uppercase tracking-[0.16em] text-[var(--color-gold)]">
                  {invitation.approval_status}
                </span>
              </button>
            ))}
            {loading ? (
              <article className="bg-[#181815] p-5 text-sm text-white/45">
                Memuat invitation client...
              </article>
            ) : null}
            {!loading && invitations.length === 0 ? (
              <article className="bg-[#181815] p-5 text-sm text-white/45">
                Belum ada invitation yang terhubung ke akun ini.
              </article>
            ) : null}
          </div>
        </section>

        <aside className="border border-white/12 bg-[#181815] p-5">
          <h2 className="font-serif text-3xl">Draft detail</h2>
          {selectedInvitation ? (
            <div className="mt-6 space-y-5">
              <div>
                <p className="text-[0.6rem] uppercase tracking-[0.16em] text-white/40">
                  Public slug
                </p>
                <p className="mt-2 font-semibold">{selectedInvitation.public_slug}</p>
              </div>
              <div className="grid gap-3 border-t border-white/10 pt-5 text-sm text-white/60">
                <p>Status: {selectedInvitation.status}</p>
                <p>Approval: {selectedInvitation.approval_status}</p>
                <p>
                  Venue: {selectedInvitation.content.event?.venue ?? "Belum diisi"}
                </p>
                <p>
                  Event:{" "}
                  {selectedInvitation.content.event?.dateLabel ?? "Belum diisi"}
                </p>
              </div>
              {selectedOrder ? (
                <div className="grid gap-3 border-t border-white/10 pt-5 text-sm text-white/60">
                  <p>Order: {selectedOrder.reference}</p>
                  <p>Order status: {selectedOrder.status}</p>
                  <p>Value: {formatCurrency(selectedOrder.total_amount)}</p>
                </div>
              ) : null}
              <button
                className="inline-flex min-h-11 w-full items-center justify-center gap-3 border border-white/15 px-4 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-white/75 transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] disabled:opacity-50"
                disabled={Boolean(savingAction)}
                onClick={() => void runInvitationAction("submit-revision")}
                type="button"
              >
                <Send size={15} />
                {savingAction === "submit-revision" ? "Submitting" : "Submit revisi"}
              </button>
              <button
                className="inline-flex min-h-11 w-full items-center justify-center gap-3 bg-[var(--color-gold)] px-4 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#17140d] transition hover:brightness-110 disabled:opacity-50"
                disabled={Boolean(savingAction)}
                onClick={() => void runInvitationAction("approve-publish")}
                type="button"
              >
                <CheckCircle2 size={15} />
                {savingAction === "approve-publish"
                  ? "Approving"
                  : "Approve publish"}
              </button>
            </div>
          ) : (
            <p className="mt-6 text-sm text-white/45">
              Pilih invitation untuk melihat detail draft.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
