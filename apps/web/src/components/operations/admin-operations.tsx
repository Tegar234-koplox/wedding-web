"use client";

import { LifeBuoy, LogOut, Music2, Plus, RefreshCw, Save } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

type Metrics = {
  orders: Record<string, number>;
  revenue_pipeline: string | number;
  audit_events: number;
  leads: number;
};

type Order = {
  id: string;
  reference: string;
  status: string;
  theme_slug: string | null;
  package_code: string | null;
  invitation_slug: string | null;
  assigned_staff_username: string | null;
  client_user_email: string | null;
  client_name: string;
  client_email: string;
  client_phone: string;
  event_date: string | null;
  total_amount: string;
  currency: string;
  notes: string;
  updated_at: string;
};

type Lead = {
  id: string;
  theme_slug: string;
  package_code: string;
  locale: string;
  campaign: string;
  source: string;
  created_at: string;
};

type ThemeOption = {
  slug: string;
  name: string;
  category: string;
};

type ThemePage = {
  results: ThemeOption[];
};

type PackageOption = {
  code: string;
  name: string;
  price: string;
  currency: string;
};

type AuditEvent = {
  id: string;
  actor_email: string | null;
  action: string;
  resource_type: string;
  resource_reference: string;
  metadata?: Record<string, unknown>;
  created_at: string;
};

type StaffUser = {
  username: string;
  email: string;
  role: string;
};

type StaffSession = {
  user: {
    username: string;
    email: string;
    role: string;
    display_name: string;
  };
};

type StaffInvitation = {
  public_slug: string;
  theme_slug: string;
  package_code: string | null;
  status: string;
  approval_status: string;
  default_locale: string;
  client_email: string | null;
  order_reference: string | null;
  order_status: string | null;
  order_client_name: string;
  published_at: string | null;
  updated_at: string;
};

type SupportTicket = {
  id: string;
  invitation_slug: string;
  category: string;
  description: string;
  attachment_url: string;
  status: string;
  resolution_note: string;
  created_by_email: string;
  assigned_staff_username: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

type GuestAggregate = {
  wedding_id: string;
  total_invited: number;
  total_confirmed: number;
  total_declined: number;
  response_rate: number;
};

type MusicAsset = {
  id: string;
  public_id: string;
  resource_type: string;
  format: string;
  secure_url: string;
  original_filename: string;
};

type InvitationMusic = {
  current: {
    id: string;
    asset: MusicAsset;
  } | null;
  available_assets: MusicAsset[];
};

const orderStatuses = [
  "lead",
  "consulting",
  "confirmed",
  "in_design",
  "client_review",
  "revision",
  "approved",
  "published",
  "completed",
  "cancelled",
];

const ticketStatuses = ["open", "in_progress", "resolved"];
const ticketCategories = ["technical", "dns", "billing", "general"];

const emptyOrderForm = {
  client_email: "",
  client_name: "",
  client_phone: "",
  currency: "IDR",
  event_date: "",
  package_code: "",
  reference: "",
  theme_slug: "",
  total_amount: "",
  whatsapp_intent_id: "",
};

type OrderForm = typeof emptyOrderForm;
type OrderFormField = keyof OrderForm;

type MusicForm = {
  assetId: string;
  secureUrl: string;
  title: string;
};

const orderFormFields: Array<{
  field: OrderFormField;
  label: string;
  placeholder: string;
  type?: "date" | "email" | "tel" | "text";
}> = [
  { field: "reference", label: "Reference", placeholder: "ord-001" },
  { field: "client_name", label: "Client name", placeholder: "Alya & Raka" },
  {
    field: "client_email",
    label: "Client email",
    placeholder: "client@example.com",
    type: "email",
  },
  { field: "client_phone", label: "Client phone", placeholder: "+62812", type: "tel" },
  { field: "event_date", label: "Event date", placeholder: "2026-09-12", type: "date" },
  { field: "total_amount", label: "Total amount", placeholder: "649000" },
];

const adminLoginPath = "/admin/login";
const staffGateCookie = "niskala_staff_gate";

class StaffFetchError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "StaffFetchError";
  }

  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

function redirectToLogin() {
  document.cookie = `${staffGateCookie}=; Path=/; Max-Age=0; SameSite=Lax; Secure`;
  window.location.replace(adminLoginPath);
}

function nextLeadReference(lead: Lead): string {
  return `lead-${lead.id.slice(0, 8)}`;
}

function validateOrderForm(form: OrderForm): string[] {
  const messages: string[] = [];
  if (!form.reference.trim()) {
    messages.push("Reference wajib diisi.");
  }
  if (!form.client_name.trim()) {
    messages.push("Client name wajib diisi.");
  }
  if (form.client_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.client_email)) {
    messages.push("Client email belum valid.");
  }
  if (form.total_amount && Number.isNaN(Number(form.total_amount))) {
    messages.push("Total amount harus berupa angka.");
  }
  return messages;
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

async function staffFetch<T>(path: string, init?: RequestInit): Promise<T> {
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
        ? "Session staff tidak valid atau CSRF kedaluwarsa"
        : response.status >= 500
          ? "Backend staff API sedang error"
          : "Request staff API ditolak";
    throw new StaffFetchError(
      `${label} (${response.status})${detail ? `: ${detail}` : ""}`,
      response.status,
    );
  }
  return response.json() as Promise<T>;
}

function formatCurrency(value: string | number): string {
  return new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(Number(value));
}

function publicInvitationUrl(invitation: Pick<StaffInvitation, "default_locale" | "public_slug">) {
  return `${env.NEXT_PUBLIC_SITE_URL}/${invitation.default_locale}/i/${invitation.public_slug}`;
}

export function AdminOperations() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [orderAuditEvents, setOrderAuditEvents] = useState<AuditEvent[]>([]);
  const [pendingPublishItems, setPendingPublishItems] = useState<StaffInvitation[]>([]);
  const [publishedInvitations, setPublishedInvitations] = useState<StaffInvitation[]>([]);
  const [guestAggregate, setGuestAggregate] = useState<GuestAggregate | null>(null);
  const [staffMusic, setStaffMusic] = useState<InvitationMusic | null>(null);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [themes, setThemes] = useState<ThemeOption[]>([]);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [staffSession, setStaffSession] = useState<StaffSession["user"] | null>(null);
  const [selectedReference, setSelectedReference] = useState<string>("");
  const [selectedTicketId, setSelectedTicketId] = useState<string>("");
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState("");
  const [ticketResolutionNote, setTicketResolutionNote] = useState("");
  const [ticketCustomDomain, setTicketCustomDomain] = useState("");
  const [ticketReason, setTicketReason] = useState("");
  const [savingTicket, setSavingTicket] = useState(false);
  const [draftStatus, setDraftStatus] = useState<string>("");
  const [draftStaff, setDraftStaff] = useState<string>("");
  const [orderForm, setOrderForm] = useState(emptyOrderForm);
  const [musicForm, setMusicForm] = useState<MusicForm>({
    assetId: "",
    secureUrl: "",
    title: "",
  });
  const [formError, setFormError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadingInvitationOps, setLoadingInvitationOps] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingMusic, setSavingMusic] = useState(false);
  const [error, setError] = useState<string>("");

  const selectedOrder = useMemo(
    () => orders.find((order) => order.reference === selectedReference) ?? orders[0],
    [orders, selectedReference],
  );

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? tickets[0],
    [tickets, selectedTicketId],
  );

  async function loadOrderAudit(reference: string) {
    if (!reference) {
      setOrderAuditEvents([]);
      return;
    }
    const nextAuditEvents = await staffFetch<AuditEvent[]>(
      `/admin/audit-events?resource_type=order&resource_reference=${reference}`,
    );
    setOrderAuditEvents(nextAuditEvents);
  }

  const loadTicketQueue = useCallback(
    async (preferredTicketId = selectedTicketId) => {
      setError("");
      try {
        const params = new URLSearchParams();
        if (ticketCategoryFilter) {
          params.set("category", ticketCategoryFilter);
        }
        if (ticketStatusFilter) {
          params.set("status", ticketStatusFilter);
        }
        const query = params.toString();
        const nextTickets = await staffFetch<SupportTicket[]>(
          `/admin/tickets${query ? `?${query}` : ""}`,
        );
        setTickets(nextTickets);
        const nextSelected =
          nextTickets.find((ticket) => ticket.id === preferredTicketId) ?? nextTickets[0];
        setSelectedTicketId(nextSelected?.id ?? "");
        setTicketResolutionNote(nextSelected?.resolution_note ?? "");
        setTicketCustomDomain("");
        setTicketReason("");
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Ticket queue gagal dimuat.");
      }
    },
    [selectedTicketId, ticketCategoryFilter, ticketStatusFilter],
  );

  const loadStaffInvitationOps = useCallback(async (publicSlug: string) => {
    setLoadingInvitationOps(true);
    setError("");
    try {
      const [nextGuestAggregate, nextMusic] = await Promise.all([
        staffFetch<GuestAggregate>(`/admin/invitations/${publicSlug}/guests`),
        staffFetch<InvitationMusic>(`/admin/invitations/${publicSlug}/music`),
      ]);
      setGuestAggregate(nextGuestAggregate);
      setStaffMusic(nextMusic);
      setMusicForm({
        assetId: nextMusic.current?.asset.id ?? "",
        secureUrl: "",
        title: "",
      });
    } catch (caught) {
      if (caught instanceof StaffFetchError && caught.isAuthError) {
        redirectToLogin();
        return;
      }
      setError(
        caught instanceof Error
          ? caught.message
          : "Data RSVP atau backsound staff gagal dimuat.",
      );
    } finally {
      setLoadingInvitationOps(false);
    }
  }, []);

  function selectOrder(order: Order) {
    setSelectedReference(order.reference);
    setDraftStatus(order.status);
    setDraftStaff(order.assigned_staff_username ?? "");
    if (!order.invitation_slug) {
      setGuestAggregate(null);
      setStaffMusic(null);
    }
    void loadOrderAudit(order.reference);
  }

  function selectTicket(ticket: SupportTicket) {
    setSelectedTicketId(ticket.id);
    setTicketResolutionNote(ticket.resolution_note ?? "");
    setTicketCustomDomain("");
    setTicketReason("");
  }

  const loadDashboard = useCallback(async (preferredReference = "") => {
    setLoading(true);
    setError("");
    try {
      const [
        nextSession,
        nextMetrics,
        nextOrders,
        nextLeads,
        nextTickets,
        nextAuditEvents,
        nextPendingPublishItems,
        nextPublishedInvitations,
        nextStaffUsers,
        nextThemes,
        nextPackages,
      ] =
        await Promise.all([
          staffFetch<StaffSession>("/auth/me"),
          staffFetch<Metrics>("/admin/dashboard/metrics"),
          staffFetch<Order[]>("/admin/orders"),
          staffFetch<Lead[]>("/admin/leads"),
          staffFetch<SupportTicket[]>("/admin/tickets"),
          staffFetch<AuditEvent[]>("/admin/audit-events"),
          staffFetch<StaffInvitation[]>("/admin/invitations?state=pending_publish"),
          staffFetch<StaffInvitation[]>("/admin/invitations?state=published"),
          staffFetch<StaffUser[]>("/admin/staff-users"),
          staffFetch<ThemePage>("/themes?locale=id&page_size=50"),
          staffFetch<PackageOption[]>("/packages?locale=id"),
        ]);
      setStaffSession(nextSession.user);
      setMetrics(nextMetrics);
      setOrders(nextOrders);
      setLeads(nextLeads);
      setTickets(nextTickets);
      setAuditEvents(nextAuditEvents);
      setPendingPublishItems(nextPendingPublishItems);
      setPublishedInvitations(nextPublishedInvitations);
      setStaffUsers(nextStaffUsers);
      setThemes(nextThemes.results);
      setPackages(nextPackages);
      const nextSelected =
        nextOrders.find((order) => order.reference === preferredReference) ??
        nextOrders[0];
      if (nextSelected) {
        setSelectedReference(nextSelected.reference);
        setDraftStatus(nextSelected.status);
        setDraftStaff(nextSelected.assigned_staff_username ?? "");
        if (!nextSelected.invitation_slug) {
          setGuestAggregate(null);
          setStaffMusic(null);
        }
        await loadOrderAudit(nextSelected.reference);
      } else {
        setOrderAuditEvents([]);
        setGuestAggregate(null);
        setStaffMusic(null);
      }
      const nextTicket = nextTickets[0];
      setSelectedTicketId(nextTicket?.id ?? "");
      setTicketResolutionNote(nextTicket?.resolution_note ?? "");
      setTicketCustomDomain("");
      setTicketReason("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Staff dashboard tidak dapat dimuat.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  async function logoutStaff() {
    setSaving(true);
    setError("");
    try {
      await staffFetch<{ ok: boolean }>("/auth/logout", { method: "POST" });
      setStaffSession(null);
      setMetrics(null);
      setOrders([]);
      setLeads([]);
      setTickets([]);
      setAuditEvents([]);
      setOrderAuditEvents([]);
      setGuestAggregate(null);
      setStaffMusic(null);
      setSelectedReference("");
      setSelectedTicketId("");
    } catch (caught) {
      if (!(caught instanceof StaffFetchError && caught.isAuthError)) {
        setError(caught instanceof Error ? caught.message : "Logout staff gagal.");
      }
    } finally {
      setSaving(false);
      redirectToLogin();
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  useEffect(() => {
    if (!selectedOrder?.invitation_slug) {
      return;
    }
    const invitationSlug = selectedOrder.invitation_slug;
    const timer = window.setTimeout(() => {
      void loadStaffInvitationOps(invitationSlug);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadStaffInvitationOps, selectedOrder?.invitation_slug]);

  async function saveSelectedOrder() {
    if (!selectedOrder) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updated = await staffFetch<Order>(
        `/admin/orders/${selectedOrder.reference}`,
        {
          body: JSON.stringify({
            assigned_staff_username: draftStaff || null,
            status: draftStatus,
          }),
          method: "PATCH",
        },
      );
      setOrders((current) =>
        current.map((order) =>
          order.reference === updated.reference ? updated : order,
        ),
      );
      await loadOrderAudit(updated.reference);
      const nextMetrics = await staffFetch<Metrics>("/admin/dashboard/metrics");
      setMetrics(nextMetrics);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Order gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSelectedTicket(status?: string, assignToSelf = false) {
    if (!selectedTicket) {
      return;
    }
    setSavingTicket(true);
    setError("");
    try {
      const payload: Record<string, string | boolean> = {
        assign_to_self: assignToSelf,
        resolution_note: ticketResolutionNote,
      };
      if (status) {
        payload.status = status;
      }
      if (selectedTicket.category === "dns" && ticketCustomDomain.trim()) {
        payload.custom_domain = ticketCustomDomain.trim();
        payload.reason = ticketReason.trim();
      } else if (ticketReason.trim()) {
        payload.reason = ticketReason.trim();
      }
      const updated = await staffFetch<SupportTicket>(
        `/admin/tickets/${selectedTicket.id}`,
        {
          body: JSON.stringify(payload),
          method: "PATCH",
        },
      );
      setTickets((current) =>
        current.map((ticket) => (ticket.id === updated.id ? updated : ticket)),
      );
      selectTicket(updated);
      const nextAuditEvents = await staffFetch<AuditEvent[]>("/admin/audit-events");
      setAuditEvents(nextAuditEvents);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ticket gagal disimpan.");
    } finally {
      setSavingTicket(false);
    }
  }

  async function publishInvitation(publicSlug: string) {
    setSaving(true);
    setError("");
    try {
      await staffFetch<{ status: string; approval_status: string }>(
        `/admin/invitations/${publicSlug}/publish`,
        { method: "POST" },
      );
      await loadDashboard(selectedReference);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invitation gagal dipublish.");
    } finally {
      setSaving(false);
    }
  }

  async function copyPublicLink(invitation: StaffInvitation) {
    setError("");
    try {
      await navigator.clipboard.writeText(publicInvitationUrl(invitation));
    } catch {
      setError("Public link gagal disalin. Buka link lalu copy dari address bar.");
    }
  }

  async function createOrder() {
    const validationMessages = validateOrderForm(orderForm);
    if (validationMessages.length > 0) {
      setFormError(validationMessages.join(" "));
      return;
    }
    setCreating(true);
    setError("");
    setFormError("");
    try {
      const created = await staffFetch<Order>("/admin/orders", {
        body: JSON.stringify({
          client_email: orderForm.client_email.trim(),
          client_name: orderForm.client_name.trim(),
          client_phone: orderForm.client_phone.trim(),
          currency: orderForm.currency || "IDR",
          event_date: orderForm.event_date || null,
          package_code: orderForm.package_code || null,
          reference: orderForm.reference.trim(),
          status: "lead",
          theme_slug: orderForm.theme_slug || null,
          total_amount: orderForm.total_amount || "0",
          whatsapp_intent_id: orderForm.whatsapp_intent_id || null,
        }),
        method: "POST",
      });
      setOrders((current) => [created, ...current]);
      setOrderForm(emptyOrderForm);
      selectOrder(created);
      const [nextMetrics, nextAuditEvents] = await Promise.all([
        staffFetch<Metrics>("/admin/dashboard/metrics"),
        staffFetch<AuditEvent[]>("/admin/audit-events"),
      ]);
      setMetrics(nextMetrics);
      setAuditEvents(nextAuditEvents);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Order gagal dibuat.");
    } finally {
      setCreating(false);
    }
  }

  function updateOrderForm(field: OrderFormField, value: string) {
    setFormError("");
    setOrderForm((current) => ({ ...current, [field]: value }));
  }

  async function saveStaffMusicSelection() {
    if (!selectedOrder?.invitation_slug) {
      setError("Order belum terhubung ke invitation.");
      return;
    }
    setSavingMusic(true);
    setError("");
    try {
      const payload = musicForm.secureUrl.trim()
        ? {
            secure_url: musicForm.secureUrl.trim(),
            title: musicForm.title.trim() || "Background music",
          }
        : { asset_id: musicForm.assetId || null };
      const nextMusic = await staffFetch<InvitationMusic>(
        `/admin/invitations/${selectedOrder.invitation_slug}/music`,
        {
          body: JSON.stringify(payload),
          method: "PATCH",
        },
      );
      setStaffMusic(nextMusic);
      setMusicForm({
        assetId: nextMusic.current?.asset.id ?? "",
        secureUrl: "",
        title: "",
      });
      const nextAuditEvents = await staffFetch<AuditEvent[]>("/admin/audit-events");
      setAuditEvents(nextAuditEvents);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Backsound gagal disimpan.");
    } finally {
      setSavingMusic(false);
    }
  }

  function updatePackage(value: string) {
    const selectedPackage = packages.find((item) => item.code === value);
    setFormError("");
    setOrderForm((current) => ({
      ...current,
      package_code: value,
      total_amount:
        selectedPackage && !current.total_amount
          ? selectedPackage.price
          : current.total_amount,
    }));
  }

  function applyLeadToOrder(lead: Lead) {
    const selectedPackage = packages.find((item) => item.code === lead.package_code);
    setFormError("");
    setOrderForm((current) => ({
      ...current,
      package_code: lead.package_code || current.package_code,
      reference: current.reference || nextLeadReference(lead),
      theme_slug: lead.theme_slug || current.theme_slug,
      total_amount:
        selectedPackage && !current.total_amount
          ? selectedPackage.price
          : current.total_amount,
      whatsapp_intent_id: lead.id,
    }));
    document.getElementById("create-order")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--color-gold)]">
            Live Staff Data
          </p>
          <p className="mt-2 text-sm text-white/55">
            Kelola order, lead, assignment, dan riwayat perubahan dari frontend.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {staffSession ? (
            <p className="text-xs uppercase tracking-[0.14em] text-white/45">
              {staffSession.display_name} / {staffSession.role}
            </p>
          ) : null}
          <button
            className="inline-flex min-h-11 items-center gap-3 border border-white/15 px-4 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white/70 transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
            disabled={loading}
            onClick={() => void loadDashboard(selectedReference)}
            type="button"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
          {staffSession ? (
            <button
              className="inline-flex min-h-11 items-center gap-3 border border-white/15 px-4 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white/70 transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
              disabled={saving}
              onClick={() => void logoutStaff()}
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
          {error}. Pastikan sudah login sebagai staff dan Redis aktif.{" "}
          <Link
            className="font-semibold underline decoration-[#d5ad55]/50 underline-offset-4"
            href={"/admin/login" as Route}
          >
            Buka staff login
          </Link>
        </div>
      ) : null}

      {pendingPublishItems.length > 0 ? (
        <section className="border border-[#d5ad55]/40 bg-[#d5ad55]/10 p-5">
          <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--color-gold)]">
                Publish queue
              </p>
              <p className="mt-2 text-sm leading-6 text-[#f4ddb0]">
                {pendingPublishItems.length} invitation sudah approved by client dan
                menunggu staff publish final.
              </p>
            </div>
            <div className="grid gap-2">
              {pendingPublishItems.map((item) => (
                <article
                  className="flex flex-wrap items-center justify-between gap-3 border border-[#d5ad55]/25 bg-black/20 p-3"
                  key={item.public_slug}
                >
                  <div>
                    <p className="font-semibold text-[#f4ddb0]">{item.public_slug}</p>
                    <p className="mt-1 text-[0.62rem] uppercase tracking-[0.12em] text-white/45">
                      {item.order_reference ?? "No order"} /{" "}
                      {item.order_client_name || item.client_email || "No client"}
                    </p>
                  </div>
                  <button
                    className="min-h-10 bg-[var(--color-gold)] px-4 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[#17140d] transition hover:brightness-110 disabled:opacity-50"
                    disabled={saving}
                    onClick={() => void publishInvitation(item.public_slug)}
                    type="button"
                  >
                    Publish final
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-px bg-white/12 md:grid-cols-4">
        {[
          ["Orders", Object.values(metrics?.orders ?? {}).reduce((a, b) => a + b, 0)],
          ["Leads", metrics?.leads ?? 0],
          ["Pipeline", formatCurrency(metrics?.revenue_pipeline ?? 0)],
          ["Audit", metrics?.audit_events ?? 0],
        ].map(([label, value]) => (
          <article className="bg-[#181815] p-5" key={label}>
            <p className="text-[0.6rem] uppercase tracking-[0.18em] text-white/45">
              {label}
            </p>
            <p className="mt-5 font-serif text-4xl">{value}</p>
          </article>
        ))}
      </div>

      {publishedInvitations.length > 0 ? (
        <section className="border border-white/12 bg-[#181815] p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--color-gold)]">
                Published delivery
              </p>
              <p className="mt-2 text-sm leading-6 text-white/55">
                Link final undangan yang sudah publish dan siap dikirim ke client.
              </p>
            </div>
            <span className="text-xs uppercase tracking-[0.16em] text-white/45">
              {publishedInvitations.length} published
            </span>
          </div>
          <div className="grid gap-2">
            {publishedInvitations.slice(0, 5).map((invitation) => (
              <article
                className="grid gap-3 border border-white/10 bg-black/20 p-3 md:grid-cols-[1fr_auto]"
                key={invitation.public_slug}
              >
                <div>
                  <p className="font-semibold">{invitation.public_slug}</p>
                  <p className="mt-1 break-all text-sm text-white/55">
                    {publicInvitationUrl(invitation)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    className="inline-flex min-h-10 items-center px-4 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-white/75 transition hover:text-[var(--color-gold)]"
                    href={publicInvitationUrl(invitation)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open
                  </a>
                  <button
                    className="min-h-10 border border-white/15 px-4 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-white/75 transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
                    onClick={() => void copyPublicLink(invitation)}
                    type="button"
                  >
                    Copy link
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section
        className="grid gap-6 border border-white/12 bg-[#181815] p-5 lg:grid-cols-[0.7fr_1.3fr]"
        id="create-order"
      >
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--color-gold)]">
            Create order
          </p>
          <h2 className="mt-4 font-serif text-4xl">Input manual staff.</h2>
          <p className="mt-5 text-sm leading-6 text-white/55">
            Pakai reference unik. Theme/package boleh dikosongkan dulu kalau lead
            belum menentukan pilihan.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {orderFormFields.map(({ field, label, placeholder, type }) => (
            <label className="grid gap-2" key={field}>
              <span className="text-[0.6rem] uppercase tracking-[0.16em] text-white/40">
                {label}
              </span>
              <input
                className="min-h-11 border border-white/15 bg-black/30 px-3 text-sm outline-none transition focus:border-[var(--color-gold)]"
                onChange={(event) => updateOrderForm(field, event.target.value)}
                placeholder={placeholder}
                type={type ?? "text"}
                value={orderForm[field]}
              />
            </label>
          ))}
          <label className="grid gap-2">
            <span className="text-[0.6rem] uppercase tracking-[0.16em] text-white/40">
              Theme
            </span>
            <select
              className="min-h-11 border border-white/15 bg-black/30 px-3 text-sm outline-none transition focus:border-[var(--color-gold)]"
              onChange={(event) => updateOrderForm("theme_slug", event.target.value)}
              value={orderForm.theme_slug}
            >
              <option value="">Belum dipilih</option>
              {themes.map((theme) => (
                <option key={theme.slug} value={theme.slug}>
                  {theme.name} / {theme.category}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-[0.6rem] uppercase tracking-[0.16em] text-white/40">
              Package
            </span>
            <select
              className="min-h-11 border border-white/15 bg-black/30 px-3 text-sm outline-none transition focus:border-[var(--color-gold)]"
              onChange={(event) => updatePackage(event.target.value)}
              value={orderForm.package_code}
            >
              <option value="">Belum dipilih</option>
              {packages.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name} / {formatCurrency(item.price)}
                </option>
              ))}
            </select>
          </label>
          {orderForm.whatsapp_intent_id ? (
            <div className="border border-white/10 bg-black/20 p-3 text-xs uppercase tracking-[0.12em] text-white/45 md:col-span-2">
              Linked lead: {orderForm.whatsapp_intent_id}
            </div>
          ) : null}
          {formError ? (
            <div className="border border-[#d5ad55]/40 bg-[#d5ad55]/10 p-3 text-sm leading-6 text-[#f4ddb0] md:col-span-2">
              {formError}
            </div>
          ) : null}
          <button
            className="inline-flex min-h-11 items-center justify-center gap-3 bg-[var(--color-gold)] px-4 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#17140d] transition hover:brightness-110 disabled:opacity-50 md:col-span-2"
            disabled={creating || !orderForm.reference || !orderForm.client_name}
            onClick={() => void createOrder()}
            type="button"
          >
            <Plus size={15} />
            {creating ? "Creating" : "Create order"}
          </button>
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[1fr_24rem]">
        <section id="orders">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="font-serif text-4xl">Order queue</h2>
            <span className="text-xs uppercase tracking-[0.16em] text-white/45">
              {orders.length} active
            </span>
          </div>
          <div className="overflow-x-auto border border-white/12">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-black/30 text-[0.6rem] uppercase tracking-[0.16em] text-white/45">
                <tr>
                  <th className="px-4 py-3">Ref</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Package</th>
                  <th className="px-4 py-3">Staff</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    className={cn(
                      "cursor-pointer border-t border-white/10 transition hover:bg-white/5",
                      selectedOrder?.reference === order.reference && "bg-[#d5ad55]/10",
                    )}
                    key={order.reference}
                    onClick={() => selectOrder(order)}
                  >
                    <td className="px-4 py-4 font-semibold">{order.reference}</td>
                    <td className="px-4 py-4 text-white/70">{order.client_name}</td>
                    <td className="px-4 py-4 text-[var(--color-gold)]">
                      {order.status}
                    </td>
                    <td className="px-4 py-4 text-white/60">
                      {order.package_code ?? "-"}
                    </td>
                    <td className="px-4 py-4 text-white/60">
                      {order.assigned_staff_username ?? "-"}
                    </td>
                  </tr>
                ))}
                {loading ? (
                  <tr>
                    <td className="px-4 py-8 text-white/45" colSpan={5}>
                      Memuat order staff...
                    </td>
                  </tr>
                ) : null}
                {!loading && orders.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-white/45" colSpan={5}>
                      Belum ada order. Buat order pertama lewat form di atas.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="border border-white/12 bg-[#181815] p-5">
          <h2 className="font-serif text-3xl">Order detail</h2>
          {selectedOrder ? (
            <div className="mt-6 space-y-5">
              <div>
                <p className="text-[0.6rem] uppercase tracking-[0.16em] text-white/40">
                  Reference
                </p>
                <p className="mt-2 font-semibold">{selectedOrder.reference}</p>
              </div>
              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.16em] text-white/40">
                  Status
                </label>
                <select
                  className="mt-2 w-full border border-white/15 bg-black/30 px-3 py-3 text-sm"
                  onChange={(event) => setDraftStatus(event.target.value)}
                  value={draftStatus}
                >
                  {orderStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[0.6rem] uppercase tracking-[0.16em] text-white/40">
                  Assigned staff
                </label>
                <select
                  className="mt-2 w-full border border-white/15 bg-black/30 px-3 py-3 text-sm"
                  onChange={(event) => setDraftStaff(event.target.value)}
                  value={draftStaff}
                >
                  <option value="">Unassigned</option>
                  {staffUsers.map((user) => (
                    <option key={user.username} value={user.username}>
                      {user.username} - {user.role}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 border-t border-white/10 pt-5 text-sm text-white/60">
                <p>{selectedOrder.client_email || "No email"}</p>
                <p>{selectedOrder.client_phone || "No phone"}</p>
                <p>{formatCurrency(selectedOrder.total_amount)}</p>
              </div>
              <button
                className="inline-flex min-h-11 w-full items-center justify-center gap-3 bg-[var(--color-gold)] px-4 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#17140d] transition hover:brightness-110 disabled:opacity-50"
                disabled={saving}
                onClick={() => void saveSelectedOrder()}
                type="button"
              >
                <Save size={15} />
                {saving ? "Saving" : "Save order"}
              </button>
              <div className="border-t border-white/10 pt-5">
                <p className="text-[0.6rem] uppercase tracking-[0.16em] text-white/40">
                  Order audit
                </p>
                <div className="mt-3 grid gap-2">
                  {orderAuditEvents.slice(0, 5).map((event) => (
                    <article className="border border-white/10 p-3" key={event.id}>
                      <p className="text-sm text-white/75">{event.action}</p>
                      <p className="mt-2 text-[0.62rem] uppercase tracking-[0.12em] text-white/40">
                        {event.actor_email ?? "system"} /{" "}
                        {new Date(event.created_at).toLocaleString("id-ID")}
                      </p>
                    </article>
                  ))}
                  {orderAuditEvents.length === 0 ? (
                    <p className="text-sm text-white/45">
                      Belum ada audit event untuk order ini.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-6 text-sm text-white/45">Pilih order dari queue.</p>
          )}
        </aside>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1fr_24rem]" id="tickets">
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--color-gold)]">
                Support queue
              </p>
              <h2 className="mt-3 font-serif text-4xl">Ticket staff.</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                className="min-h-10 border border-white/15 bg-black/30 px-3 text-xs uppercase tracking-[0.12em] text-white/70 outline-none transition focus:border-[var(--color-gold)]"
                onChange={(event) => setTicketCategoryFilter(event.target.value)}
                value={ticketCategoryFilter}
              >
                <option value="">All category</option>
                {ticketCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <select
                className="min-h-10 border border-white/15 bg-black/30 px-3 text-xs uppercase tracking-[0.12em] text-white/70 outline-none transition focus:border-[var(--color-gold)]"
                onChange={(event) => setTicketStatusFilter(event.target.value)}
                value={ticketStatusFilter}
              >
                <option value="">All status</option>
                {ticketStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <button
                className="inline-flex min-h-10 items-center gap-2 border border-white/15 px-3 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-white/70 transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
                onClick={() => void loadTicketQueue()}
                type="button"
              >
                <RefreshCw size={14} />
                Filter
              </button>
            </div>
          </div>
          <div className="grid gap-px bg-white/12">
            {tickets.map((ticket) => (
              <button
                className={cn(
                  "grid gap-3 bg-[#181815] p-4 text-left transition hover:bg-white/5 md:grid-cols-[1fr_auto]",
                  selectedTicket?.id === ticket.id && "bg-[#d5ad55]/10",
                )}
                key={ticket.id}
                onClick={() => selectTicket(ticket)}
                type="button"
              >
                <div>
                  <p className="font-semibold">
                    {ticket.category} / {ticket.invitation_slug}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/55">
                    {ticket.description}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.13em] text-white/40">
                    {ticket.created_by_email} / assigned{" "}
                    {ticket.assigned_staff_username ?? "-"}
                  </p>
                </div>
                <span className="text-xs uppercase tracking-[0.14em] text-[var(--color-gold)]">
                  {ticket.status}
                </span>
              </button>
            ))}
            {!loading && tickets.length === 0 ? (
              <article className="bg-[#181815] p-4 text-sm text-white/45">
                Belum ada support ticket untuk filter ini.
              </article>
            ) : null}
          </div>
        </section>

        <aside className="border border-white/12 bg-[#181815] p-5">
          {selectedTicket ? (
            <div className="grid gap-5">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--color-gold)]">
                  Ticket detail
                </p>
                <h3 className="mt-3 font-serif text-3xl">
                  {selectedTicket.category}
                </h3>
                <p className="mt-3 text-sm leading-6 text-white/55">
                  {selectedTicket.description}
                </p>
                {selectedTicket.attachment_url ? (
                  <a
                    className="mt-3 inline-flex text-sm text-[var(--color-gold)] underline underline-offset-4"
                    href={selectedTicket.attachment_url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open attachment
                  </a>
                ) : null}
              </div>
              <label className="grid gap-2">
                <span className="text-[0.6rem] uppercase tracking-[0.16em] text-white/40">
                  Resolution note
                </span>
                <textarea
                  className="min-h-24 border border-white/15 bg-black/30 px-3 py-3 text-sm outline-none transition focus:border-[var(--color-gold)]"
                  onChange={(event) => setTicketResolutionNote(event.target.value)}
                  value={ticketResolutionNote}
                />
              </label>
              {selectedTicket.category === "dns" ? (
                <>
                  <label className="grid gap-2">
                    <span className="text-[0.6rem] uppercase tracking-[0.16em] text-white/40">
                      Custom domain
                    </span>
                    <input
                      className="min-h-11 border border-white/15 bg-black/30 px-3 text-sm outline-none transition focus:border-[var(--color-gold)]"
                      onChange={(event) => setTicketCustomDomain(event.target.value)}
                      placeholder="undangan.example.com"
                      value={ticketCustomDomain}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-[0.6rem] uppercase tracking-[0.16em] text-white/40">
                      Reason
                    </span>
                    <input
                      className="min-h-11 border border-white/15 bg-black/30 px-3 text-sm outline-none transition focus:border-[var(--color-gold)]"
                      onChange={(event) => setTicketReason(event.target.value)}
                      placeholder="DNS ownership verified"
                      value={ticketReason}
                    />
                  </label>
                </>
              ) : null}
              <div className="grid gap-2">
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-3 border border-white/15 px-4 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-white/70 transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] disabled:opacity-50"
                  disabled={savingTicket}
                  onClick={() => void saveSelectedTicket(undefined, true)}
                  type="button"
                >
                  <LifeBuoy size={15} />
                  Assign to self
                </button>
                {ticketStatuses.map((status) => (
                  <button
                    className="inline-flex min-h-11 items-center justify-center gap-3 bg-[var(--color-gold)] px-4 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#17140d] transition hover:brightness-110 disabled:opacity-50"
                    disabled={savingTicket || selectedTicket.status === status}
                    key={status}
                    onClick={() => void saveSelectedTicket(status)}
                    type="button"
                  >
                    Set {status}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm leading-6 text-white/45">
              Pilih ticket untuk assignment, update status, atau resolusi DNS.
            </p>
          )}
        </aside>
      </div>

      <div className="grid gap-8 lg:grid-cols-2" id="rsvp">
        <section className="border border-white/12 bg-[#181815] p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--color-gold)]">
                RSVP aggregate
              </p>
              <h2 className="mt-3 font-serif text-3xl">Ringkasan tamu.</h2>
            </div>
            <span className="text-xs uppercase tracking-[0.16em] text-white/45">
              aggregate only
            </span>
          </div>
          {selectedOrder?.invitation_slug ? (
            <div className="space-y-5">
              <div className="grid gap-px bg-white/12 md:grid-cols-2">
                {[
                  ["Total invited", guestAggregate?.total_invited ?? 0],
                  ["Confirmed", guestAggregate?.total_confirmed ?? 0],
                  ["Declined", guestAggregate?.total_declined ?? 0],
                  [
                    "Response rate",
                    `${Math.round(guestAggregate?.response_rate ?? 0)}%`,
                  ],
                ].map(([label, value]) => (
                  <article className="bg-black/20 p-4" key={label}>
                    <p className="text-[0.6rem] uppercase tracking-[0.16em] text-white/40">
                      {label}
                    </p>
                    <p className="mt-4 font-serif text-3xl">{value}</p>
                  </article>
                ))}
                {loadingInvitationOps ? (
                  <article className="bg-black/20 p-4 text-sm text-white/45 md:col-span-2">
                    Memuat ringkasan RSVP...
                  </article>
                ) : null}
              </div>
              <p className="text-sm leading-6 text-white/45">
                Staff hanya melihat angka agregat. Nama, kontak, ucapan, dan detail
                tamu dikelola oleh client atau public RSVP flow.
              </p>
            </div>
          ) : (
            <p className="text-sm leading-6 text-white/45">
              Pilih order yang sudah terhubung ke invitation untuk mengelola RSVP.
            </p>
          )}
        </section>

        <section className="border border-white/12 bg-[#181815] p-5" id="music">
          <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--color-gold)]">
            Backsound
          </p>
          <h2 className="mt-3 font-serif text-3xl">Musik undangan.</h2>
          {selectedOrder?.invitation_slug ? (
            <div className="mt-5 grid gap-3">
              <div className="border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                {staffMusic?.current ? (
                  <>
                    <p className="font-semibold text-white/80">
                      {staffMusic.current.asset.original_filename ||
                        "Background music"}
                    </p>
                    <p className="mt-2 break-all">
                      {staffMusic.current.asset.secure_url}
                    </p>
                  </>
                ) : (
                  <p>Belum ada backsound yang dipilih.</p>
                )}
              </div>
              <label className="grid gap-2">
                <span className="text-[0.6rem] uppercase tracking-[0.16em] text-white/40">
                  Pilih asset tersedia
                </span>
                <select
                  className="min-h-11 border border-white/15 bg-black/30 px-3 text-sm outline-none transition focus:border-[var(--color-gold)]"
                  onChange={(event) =>
                    setMusicForm((current) => ({
                      ...current,
                      assetId: event.target.value,
                      secureUrl: "",
                    }))
                  }
                  value={musicForm.assetId}
                >
                  <option value="">Tidak memakai asset tersimpan</option>
                  {staffMusic?.available_assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.original_filename || asset.public_id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-[0.6rem] uppercase tracking-[0.16em] text-white/40">
                  Atau Cloudinary audio URL
                </span>
                <input
                  className="min-h-11 border border-white/15 bg-black/30 px-3 text-sm outline-none transition focus:border-[var(--color-gold)]"
                  onChange={(event) =>
                    setMusicForm((current) => ({
                      ...current,
                      assetId: "",
                      secureUrl: event.target.value,
                    }))
                  }
                  placeholder="https://res.cloudinary.com/.../song.mp3"
                  value={musicForm.secureUrl}
                />
              </label>
              <label className="grid gap-2">
                <span className="text-[0.6rem] uppercase tracking-[0.16em] text-white/40">
                  Judul musik
                </span>
                <input
                  className="min-h-11 border border-white/15 bg-black/30 px-3 text-sm outline-none transition focus:border-[var(--color-gold)]"
                  disabled={!musicForm.secureUrl}
                  onChange={(event) =>
                    setMusicForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Background music"
                  value={musicForm.title}
                />
              </label>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-3 bg-[var(--color-gold)] px-4 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#17140d] transition hover:brightness-110 disabled:opacity-50"
                disabled={savingMusic}
                onClick={() => void saveStaffMusicSelection()}
                type="button"
              >
                <Music2 size={15} />
                {savingMusic ? "Saving music" : "Save backsound"}
              </button>
            </div>
          ) : (
            <p className="mt-5 text-sm leading-6 text-white/45">
              Pilih order yang sudah memiliki invitation untuk mengatur backsound.
            </p>
          )}
        </section>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section id="leads">
          <h2 className="mb-4 font-serif text-4xl">Recent leads</h2>
          <div className="grid gap-px bg-white/12">
            {leads.slice(0, 8).map((lead) => (
              <article className="bg-[#181815] p-4" key={lead.id}>
                <div className="flex flex-wrap justify-between gap-3 text-sm">
                  <span>{lead.theme_slug || "General inquiry"}</span>
                  <span className="text-[var(--color-gold)]">
                    {lead.package_code || "package unset"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-white/40">
                    {lead.source || "direct"} / {lead.campaign || "no campaign"}
                  </p>
                  <button
                    className="min-h-9 border border-white/15 px-3 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-white/65 transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
                    onClick={() => applyLeadToOrder(lead)}
                    type="button"
                  >
                    Use lead
                  </button>
                </div>
              </article>
            ))}
            {!loading && leads.length === 0 ? (
              <article className="bg-[#181815] p-4 text-sm text-white/45">
                Belum ada lead WhatsApp.
              </article>
            ) : null}
          </div>
        </section>

        <section id="audit">
          <h2 className="mb-4 font-serif text-4xl">Audit trail</h2>
          <div className="grid gap-px bg-white/12">
            {auditEvents.slice(0, 8).map((event) => (
              <article className="bg-[#181815] p-4" key={event.id}>
                <div className="flex flex-wrap justify-between gap-3 text-sm">
                  <span>{event.action}</span>
                  <span className="text-white/45">{event.resource_reference}</span>
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.14em] text-white/40">
                  {event.actor_email ?? "system"} /{" "}
                  {new Date(event.created_at).toLocaleString("id-ID")}
                </p>
              </article>
            ))}
            {!loading && auditEvents.length === 0 ? (
              <article className="bg-[#181815] p-4 text-sm text-white/45">
                Belum ada audit event global.
              </article>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
