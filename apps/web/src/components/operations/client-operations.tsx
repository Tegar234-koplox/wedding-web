"use client";

import { CheckCircle2, LogOut, RefreshCw, Save, Send } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
      address?: string;
      dateLabel?: string;
      mapUrl?: string;
      venue?: string;
    };
    story?: {
      body?: string;
    };
  };
  updated_at: string;
};

type ClientProfile = {
  user: {
    username: string;
    email: string;
    role: string;
    display_name: string;
  };
};

type DraftForm = {
  partnerOne: string;
  partnerTwo: string;
  dateLabel: string;
  venue: string;
  address: string;
  mapUrl: string;
  storyBody: string;
};

const clientLoginPath = "/client/login";

class ClientFetchError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ClientFetchError";
  }

  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

function redirectToClientLogin() {
  window.location.replace(clientLoginPath);
}

function formFromInvitation(invitation: ClientInvitation | undefined): DraftForm {
  const content = invitation?.content ?? {};
  return {
    address: content.event?.address ?? "",
    dateLabel: content.event?.dateLabel ?? "",
    mapUrl: content.event?.mapUrl ?? "",
    partnerOne: content.couple?.partnerOne ?? "",
    partnerTwo: content.couple?.partnerTwo ?? "",
    storyBody: content.story?.body ?? "",
    venue: content.event?.venue ?? "",
  };
}

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
    let detail = "";
    try {
      const payload = (await response.json()) as {
        error?: { details?: unknown; message?: string };
      };
      detail =
        payload.error?.message ??
        (payload.error?.details
          ? JSON.stringify(payload.error.details)
          : "");
    } catch {
      detail = response.statusText;
    }
    const label =
      response.status === 401 || response.status === 403
        ? "Session client tidak aktif"
        : response.status >= 500
          ? "Backend client API sedang error"
          : "Request client API ditolak";
    throw new ClientFetchError(
      `${label} (${response.status})${detail ? `: ${detail}` : ""}`,
      response.status,
    );
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
  const [profile, setProfile] = useState<ClientProfile["user"] | null>(null);
  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [invitations, setInvitations] = useState<ClientInvitation[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const selectedSlugRef = useRef("");
  const [draftForm, setDraftForm] = useState<DraftForm>(formFromInvitation(undefined));
  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
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
      const [nextProfile, nextOrders, nextInvitations] = await Promise.all([
        clientFetch<ClientProfile>("/client/profile"),
        clientFetch<ClientOrder[]>("/client/orders"),
        clientFetch<ClientInvitation[]>("/client/invitations"),
      ]);
      setProfile(nextProfile.user);
      setOrders(nextOrders);
      setInvitations(nextInvitations);
      const nextSlug = selectedSlugRef.current || nextInvitations[0]?.public_slug || "";
      const nextSelected = nextInvitations.find(
        (invitation) => invitation.public_slug === nextSlug,
      );
      selectedSlugRef.current = nextSlug;
      setSelectedSlug(nextSlug);
      setDraftForm(formFromInvitation(nextSelected));
    } catch (caught) {
      if (caught instanceof ClientFetchError && caught.isAuthError) {
        redirectToClientLogin();
        return;
      }
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

  async function logoutClient() {
    setSavingAction("logout");
    setError("");
    try {
      await clientFetch<{ ok: boolean }>("/auth/logout", { method: "POST" });
    } catch (caught) {
      if (!(caught instanceof ClientFetchError && caught.isAuthError)) {
        setError(caught instanceof Error ? caught.message : "Logout client gagal.");
      }
    } finally {
      redirectToClientLogin();
    }
  }

  function updateDraftForm(field: keyof DraftForm, value: string) {
    setDraftForm((current) => ({ ...current, [field]: value }));
  }

  async function saveDraftContent() {
    if (!selectedInvitation) {
      return;
    }
    setSavingDraft(true);
    setError("");
    try {
      const nextContent = {
        ...selectedInvitation.content,
        couple: {
          ...selectedInvitation.content.couple,
          partnerOne: draftForm.partnerOne,
          partnerTwo: draftForm.partnerTwo,
        },
        event: {
          ...selectedInvitation.content.event,
          address: draftForm.address,
          dateLabel: draftForm.dateLabel,
          mapUrl: draftForm.mapUrl,
          venue: draftForm.venue,
        },
        story: {
          ...selectedInvitation.content.story,
          body: draftForm.storyBody,
        },
      };
      const updated = await clientFetch<ClientInvitation>(
        `/client/invitations/${selectedInvitation.public_slug}`,
        {
          body: JSON.stringify({ content: nextContent }),
          method: "PATCH",
        },
      );
      setInvitations((current) =>
        current.map((invitation) =>
          invitation.public_slug === updated.public_slug ? updated : invitation,
        ),
      );
      setDraftForm(formFromInvitation(updated));
    } catch (caught) {
      if (caught instanceof ClientFetchError && caught.isAuthError) {
        redirectToClientLogin();
        return;
      }
      setError(caught instanceof Error ? caught.message : "Draft gagal disimpan.");
    } finally {
      setSavingDraft(false);
    }
  }

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
      if (caught instanceof ClientFetchError && caught.isAuthError) {
        redirectToClientLogin();
        return;
      }
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
        <div className="flex flex-wrap items-center gap-3">
          {profile ? (
            <p className="text-xs uppercase tracking-[0.14em] text-white/45">
              {profile.display_name} / {profile.role}
            </p>
          ) : null}
          <button
            className="inline-flex min-h-11 items-center gap-3 border border-white/15 px-4 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white/70 transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
            disabled={loading}
            onClick={() => void loadClientData()}
            type="button"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
          {profile ? (
            <button
              className="inline-flex min-h-11 items-center gap-3 border border-white/15 px-4 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white/70 transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
              disabled={savingAction === "logout"}
              onClick={() => void logoutClient()}
              type="button"
            >
              <LogOut size={15} />
              Logout
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="border border-[#d5ad55]/40 bg-[#d5ad55]/10 p-5 text-sm leading-6 text-[#f4ddb0]">
          {error}. Login sebagai client yang memiliki order/invitation, lalu refresh.{" "}
          <Link
            className="font-semibold underline decoration-[#d5ad55]/50 underline-offset-4"
            href={"/client/login" as Route}
          >
            Buka client login
          </Link>
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
                onClick={() => {
                  selectedSlugRef.current = invitation.public_slug;
                  setSelectedSlug(invitation.public_slug);
                  setDraftForm(formFromInvitation(invitation));
                }}
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
              <div className="grid gap-3 border-t border-white/10 pt-5">
                {[
                  ["partnerOne", "Partner one"],
                  ["partnerTwo", "Partner two"],
                  ["dateLabel", "Date label"],
                  ["venue", "Venue"],
                  ["address", "Address"],
                  ["mapUrl", "Map URL"],
                ].map(([field, label]) => (
                  <label className="grid gap-2" key={field}>
                    <span className="text-[0.6rem] uppercase tracking-[0.16em] text-white/40">
                      {label}
                    </span>
                    <input
                      className="min-h-11 border border-white/15 bg-black/30 px-3 text-sm outline-none transition focus:border-[var(--color-gold)]"
                      onChange={(event) =>
                        updateDraftForm(field as keyof DraftForm, event.target.value)
                      }
                      value={draftForm[field as keyof DraftForm]}
                    />
                  </label>
                ))}
                <label className="grid gap-2">
                  <span className="text-[0.6rem] uppercase tracking-[0.16em] text-white/40">
                    Story
                  </span>
                  <textarea
                    className="min-h-28 resize-y border border-white/15 bg-black/30 px-3 py-3 text-sm outline-none transition focus:border-[var(--color-gold)]"
                    onChange={(event) =>
                      updateDraftForm("storyBody", event.target.value)
                    }
                    value={draftForm.storyBody}
                  />
                </label>
                <button
                  className="inline-flex min-h-11 w-full items-center justify-center gap-3 border border-white/15 px-4 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-white/75 transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] disabled:opacity-50"
                  disabled={savingDraft}
                  onClick={() => void saveDraftContent()}
                  type="button"
                >
                  <Save size={15} />
                  {savingDraft ? "Saving draft" : "Save draft"}
                </button>
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
