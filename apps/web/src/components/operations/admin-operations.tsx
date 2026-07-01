"use client";

import {
  CheckCircle2,
  Copy,
  ExternalLink,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Search,
} from "lucide-react";
import type { ReactNode } from "react";
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
  payment_status: PaymentStatus;
  payment_status_label?: string;
  workflow_label?: string;
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
  payment_method?: string;
  proof_url?: string;
  notes: string;
  updated_at: string;
};

type PaymentStatus = "unpaid" | "dp" | "paid";

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

type StaffUser = {
  username: string;
  email: string;
  display_name: string;
  role: string;
};

type StaffSession = {
  user: StaffUser;
};

type DetailEvent = {
  id: string;
  event_type: "ceremony" | "reception" | "other";
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  venue_name: string;
  address: string;
  map_url: string;
  location: null | {
    province: string;
    regency: string;
    district: string;
    village: string;
    bmkg_adm4: string;
    latitude: string | null;
    longitude: string | null;
  };
};

type DetailMedia = {
  id: string;
  role: "photo" | "gallery" | "backsound" | string;
  sort_order: number;
  asset: {
    id: string;
    public_id: string;
    resource_type: string;
    format: string;
    secure_url: string;
    original_filename: string;
  };
};

type DetailRevision = {
  id: string;
  revision_number: number;
  label: string;
  note: string;
  is_final_check: boolean;
  created_at: string;
  created_by_email: string | null;
};

type StaffOrderDetail = {
  order: Order;
  invitation: null | {
    id: string;
    public_slug: string;
    status: string;
    approval_status: string;
    default_locale: string;
    theme_slug: string;
    package_code: string | null;
    renderer_key: string;
    bank_accounts: Array<Record<string, string>>;
    partner_one: Record<string, string>;
    partner_two: Record<string, string>;
  };
  events: DetailEvent[];
  media: DetailMedia[];
  rsvp: {
    total_invited: number;
    total_confirmed: number;
    total_declined: number;
    response_rate: number;
  };
  preview_url: string;
  revisions: DetailRevision[];
};

const staffGateCookie = "niskala_staff_gate";

const orderStatuses = [
  "lead",
  "pending",
  "consulting",
  "confirmed",
  "in_design",
  "verified",
  "client_review",
  "revision",
  "approved",
  "published",
  "completed",
  "cancelled",
  "rejected",
];

const workflowLabels = ["Baru", "Data Kurang", "Proses", "Revisi", "Final", "Publikasi"];

const paymentLabels: Record<PaymentStatus, string> = {
  unpaid: "Belum Bayar",
  dp: "DP",
  paid: "Lunas",
};

const controlClassName =
  "min-h-11 w-full border border-white/12 bg-black/20 px-3 text-sm text-white outline-none focus:border-[var(--color-gold)]";

const statusWorkflow: Record<string, string> = {
  lead: "Baru",
  pending: "Baru",
  consulting: "Baru",
  confirmed: "Data Kurang",
  in_design: "Proses",
  verified: "Proses",
  revision: "Revisi",
  client_review: "Revisi",
  approved: "Final",
  completed: "Final",
  published: "Publikasi",
};

class StaffFetchError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "StaffFetchError";
  }
}

function staffGateCookieAttributes(maxAge: number) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  return `Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

function redirectToLogin() {
  document.cookie = `${staffGateCookie}=; ${staffGateCookieAttributes(0)}`;
  window.location.replace("/admin/login");
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
        detail?: string;
        error?: { details?: unknown; message?: string };
      };
      detail =
        payload.detail ??
        payload.error?.message ??
        (payload.error?.details ? JSON.stringify(payload.error.details) : "");
    } catch {
      detail = response.statusText;
    }
    const label =
      response.status === 401 || response.status === 403
        ? "Session staff tidak valid"
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
  }).format(Number(value || 0));
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return "Belum diisi";
  }
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function workflowFor(order: Pick<Order, "status" | "workflow_label">): string {
  return order.workflow_label ?? statusWorkflow[order.status] ?? order.status;
}

function safeValue(value?: string | null): string {
  return value && value.trim() ? value : "Belum diisi";
}

function mediaCount(media: DetailMedia[], role: string): number {
  return media.filter((item) => item.role === role).length;
}

export function AdminOperations() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [detail, setDetail] = useState<StaffOrderDetail | null>(null);
  const [staffSession, setStaffSession] = useState<StaffUser | null>(null);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [themes, setThemes] = useState<ThemeOption[]>([]);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [selectedReference, setSelectedReference] = useState("");
  const [search, setSearch] = useState("");
  const [workflowFilter, setWorkflowFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const [draftPaymentStatus, setDraftPaymentStatus] = useState<PaymentStatus>("unpaid");
  const [draftStaff, setDraftStaff] = useState("");
  const [draftTheme, setDraftTheme] = useState("");
  const [draftPackage, setDraftPackage] = useState("");
  const [revisionNote, setRevisionNote] = useState("");
  const [finalCheck, setFinalCheck] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingRevision, setSavingRevision] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedOrder = useMemo(
    () => orders.find((order) => order.reference === selectedReference) ?? orders[0] ?? null,
    [orders, selectedReference],
  );

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((order) => {
      const workflow = workflowFor(order);
      const matchesQuery =
        !query ||
        [
          order.reference,
          order.client_name,
          order.client_email,
          order.client_phone,
          order.status,
          workflow,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesWorkflow = !workflowFilter || workflow === workflowFilter;
      const matchesPayment = !paymentFilter || order.payment_status === paymentFilter;
      return matchesQuery && matchesWorkflow && matchesPayment;
    });
  }, [orders, paymentFilter, search, workflowFilter]);

  const ceremony = detail?.events.find((event) => event.event_type === "ceremony") ?? null;
  const reception = detail?.events.find((event) => event.event_type === "reception") ?? null;
  const backsound = detail?.media.find((item) => item.role === "backsound") ?? null;
  const photoTotal = detail ? mediaCount(detail.media, "photo") : 0;
  const galleryTotal = detail ? mediaCount(detail.media, "gallery") : 0;
  const activeOrder = detail?.order ?? selectedOrder;

  const loadOrderDetail = useCallback(async (reference: string) => {
    if (!reference) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    try {
      const nextDetail = await staffFetch<StaffOrderDetail>(`/admin/orders/${reference}`);
      setDetail(nextDetail);
      setDraftStatus(nextDetail.order.status);
      setDraftPaymentStatus(nextDetail.order.payment_status);
      setDraftStaff(nextDetail.order.assigned_staff_username ?? "");
      setDraftTheme(nextDetail.order.theme_slug ?? "");
      setDraftPackage(nextDetail.order.package_code ?? "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Detail order gagal dimuat.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadDashboard = useCallback(
    async (preferredReference = "") => {
      setLoading(true);
      setError("");
      setNotice("");
      try {
        const [nextSession, nextMetrics, nextOrders, nextStaffUsers, nextThemes, nextPackages] =
          await Promise.all([
            staffFetch<StaffSession>("/auth/me"),
            staffFetch<Metrics>("/admin/dashboard/metrics"),
            staffFetch<Order[]>("/admin/orders"),
            staffFetch<StaffUser[]>("/admin/staff-users"),
            staffFetch<ThemePage>("/themes?locale=id&page_size=50"),
            staffFetch<PackageOption[]>("/packages?locale=id"),
          ]);
        setStaffSession(nextSession.user);
        setMetrics(nextMetrics);
        setOrders(nextOrders);
        setStaffUsers(nextStaffUsers);
        setThemes(nextThemes.results);
        setPackages(nextPackages);
        const nextReference =
          preferredReference && nextOrders.some((order) => order.reference === preferredReference)
            ? preferredReference
            : nextOrders[0]?.reference ?? "";
        setSelectedReference(nextReference);
        await loadOrderDetail(nextReference);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Dashboard staff gagal dimuat.");
      } finally {
        setLoading(false);
      }
    },
    [loadOrderDetail],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  async function selectOrder(reference: string) {
    setSelectedReference(reference);
    setError("");
    setNotice("");
    await loadOrderDetail(reference);
  }

  async function saveOrder() {
    if (!activeOrder) {
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const nextDetail = await staffFetch<StaffOrderDetail>(
        `/admin/orders/${activeOrder.reference}`,
        {
          body: JSON.stringify({
            assigned_staff_username: draftStaff || null,
            package_code: draftPackage || null,
            payment_status: draftPaymentStatus,
            status: draftStatus,
            theme_slug: draftTheme || null,
          }),
          method: "PATCH",
        },
      );
      setDetail(nextDetail);
      setOrders((current) =>
        current.map((order) =>
          order.reference === nextDetail.order.reference ? nextDetail.order : order,
        ),
      );
      const nextMetrics = await staffFetch<Metrics>("/admin/dashboard/metrics");
      setMetrics(nextMetrics);
      setNotice("Order tersimpan.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Order gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function addRevisionNote() {
    if (!activeOrder || !revisionNote.trim()) {
      setError("Catatan revisi wajib diisi.");
      return;
    }
    setSavingRevision(true);
    setError("");
    setNotice("");
    try {
      const nextDetail = await staffFetch<StaffOrderDetail>(
        `/admin/orders/${activeOrder.reference}/revisions`,
        {
          body: JSON.stringify({
            is_final_check: finalCheck,
            note: revisionNote.trim(),
          }),
          method: "POST",
        },
      );
      setDetail(nextDetail);
      setRevisionNote("");
      setFinalCheck(false);
      setNotice("Catatan revisi ditambahkan.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Catatan revisi gagal ditambahkan.");
    } finally {
      setSavingRevision(false);
    }
  }

  async function publishFinal() {
    if (!detail?.invitation) {
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await staffFetch<{ status: string; approval_status: string }>(
        `/admin/invitations/${detail.invitation.public_slug}/publish`,
        { method: "POST" },
      );
      await loadDashboard(activeOrder?.reference ?? selectedReference);
      setNotice("Invitation sudah dipublikasi.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Publish final gagal.");
    } finally {
      setSaving(false);
    }
  }

  async function copyPreviewUrl() {
    if (!detail?.preview_url) {
      return;
    }
    try {
      await navigator.clipboard.writeText(detail.preview_url);
      setNotice("Link preview disalin.");
    } catch {
      setError("Link preview gagal disalin. Buka link lalu copy dari address bar.");
    }
  }

  async function logoutStaff() {
    setSaving(true);
    setError("");
    try {
      await staffFetch<{ ok: boolean }>("/auth/logout", { method: "POST" });
    } catch {
      // Logout tetap membersihkan gate lokal agar staf kembali ke form login.
    } finally {
      setSaving(false);
      redirectToLogin();
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase text-[var(--color-gold)]">Live staff data</p>
          <p className="mt-2 text-sm text-white/55">
            Dashboard operasional untuk order, data client, pembayaran, preview, dan revisi.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {staffSession ? (
            <p className="text-xs uppercase text-white/45">
              {staffSession.display_name} / {staffSession.role}
            </p>
          ) : null}
          <button
            className="inline-flex min-h-11 items-center gap-3 border border-white/15 px-4 text-xs font-semibold uppercase text-white/70 transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] disabled:opacity-45"
            disabled={loading}
            onClick={() => void loadDashboard(selectedReference)}
            type="button"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
          <button
            className="inline-flex min-h-11 items-center gap-3 border border-white/15 px-4 text-xs font-semibold uppercase text-white/70 transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] disabled:opacity-45"
            disabled={saving}
            onClick={() => void logoutStaff()}
            type="button"
          >
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </div>

      {error ? (
        <div className="border border-[#d5ad55]/40 bg-[#d5ad55]/10 p-5 text-sm leading-6 text-[#f4ddb0]">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="flex items-center gap-3 border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-100">
          <CheckCircle2 size={16} />
          {notice}
        </div>
      ) : null}

      <section className="grid gap-px bg-white/10 md:grid-cols-4">
        <MetricCard label="Order" value={String(orders.length)} />
        <MetricCard label="Pipeline" value={formatCurrency(metrics?.revenue_pipeline ?? 0)} />
        <MetricCard
          label="Publikasi"
          value={String(
            orders.filter((order) => workflowFor(order) === "Publikasi").length,
          )}
        />
        <MetricCard label="Audit" value={String(metrics?.audit_events ?? 0)} />
      </section>

      <div
        className="grid gap-8 xl:grid-cols-[21rem_minmax(0,1fr)_24rem]"
        id="orders"
      >
        <aside className="space-y-4">
          <Panel>
            <PanelHeader eyebrow="Daftar Order" title="Semua order." />
            <div className="mt-5 space-y-3">
              <label className="flex min-h-11 items-center gap-3 border border-white/12 bg-black/20 px-3 text-sm text-white/60">
                <Search size={15} />
                <input
                  className="w-full bg-transparent outline-none placeholder:text-white/30"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari client, ref, status"
                  value={search}
                />
              </label>
              <select
                className="min-h-11 w-full border border-white/12 bg-black/20 px-3 text-sm text-white/70 outline-none focus:border-[var(--color-gold)]"
                onChange={(event) => setWorkflowFilter(event.target.value)}
                value={workflowFilter}
              >
                <option value="">Semua status pengerjaan</option>
                {workflowLabels.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                className="min-h-11 w-full border border-white/12 bg-black/20 px-3 text-sm text-white/70 outline-none focus:border-[var(--color-gold)]"
                onChange={(event) => setPaymentFilter(event.target.value)}
                value={paymentFilter}
              >
                <option value="">Semua pembayaran</option>
                {Object.entries(paymentLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </Panel>

          <div className="max-h-[42rem] overflow-auto border border-white/12">
            {loading ? (
              <p className="p-5 text-sm text-white/45">Memuat order...</p>
            ) : null}
            {!loading && filteredOrders.length === 0 ? (
              <p className="p-5 text-sm text-white/45">Tidak ada order yang cocok.</p>
            ) : null}
            {filteredOrders.map((order) => {
              const selected = order.reference === activeOrder?.reference;
              return (
                <button
                  className={cn(
                    "block w-full border-b border-white/10 p-4 text-left transition last:border-b-0 hover:bg-white/[0.04]",
                    selected ? "bg-[#d5ad55]/14" : "bg-[#11110f]",
                  )}
                  key={order.reference}
                  onClick={() => void selectOrder(order.reference)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-white">{order.client_name}</p>
                      <p className="mt-1 text-xs text-white/45">{order.reference}</p>
                    </div>
                    <span className="text-xs text-[var(--color-gold)]">
                      {workflowFor(order)}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 text-xs text-white/45">
                    <span>{paymentLabels[order.payment_status] ?? order.payment_status}</span>
                    <span>{formatCurrency(order.total_amount)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="space-y-6" id="detail">
          <Panel>
            <PanelHeader
              eyebrow="Status pengerjaan"
              title={activeOrder?.client_name ?? "Pilih order."}
              aside={activeOrder ? workflowFor(activeOrder) : undefined}
            />
            {activeOrder ? (
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <Field label="Status">
                  <select
                    className={controlClassName}
                    onChange={(event) => setDraftStatus(event.target.value)}
                    value={draftStatus}
                  >
                    {orderStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Assigned staff">
                  <select
                    className={controlClassName}
                    onChange={(event) => setDraftStaff(event.target.value)}
                    value={draftStaff}
                  >
                    <option value="">Belum assigned</option>
                    {staffUsers.map((staff) => (
                      <option key={staff.username} value={staff.username}>
                        {staff.display_name || staff.username}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Pembayaran">
                  <select
                    className={controlClassName}
                    onChange={(event) => setDraftPaymentStatus(event.target.value as PaymentStatus)}
                    value={draftPaymentStatus}
                  >
                    {Object.entries(paymentLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            ) : (
              <p className="mt-6 text-sm text-white/45">Pilih order dari daftar kiri.</p>
            )}
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Data Client" title="Informasi acara." />
            {detailLoading ? (
              <p className="mt-6 text-sm text-white/45">Memuat detail order...</p>
            ) : (
              <div className="mt-6 grid gap-px bg-white/10 md:grid-cols-2">
                <Info label="Nama" value={safeValue(activeOrder?.client_name)} />
                <Info label="Kontak" value={safeValue(activeOrder?.client_email)} />
                <Info label="Telepon" value={safeValue(activeOrder?.client_phone)} />
                <Info label="Tanggal akad" value={formatDateTime(ceremony?.starts_at)} />
                <Info label="Tanggal resepsi" value={formatDateTime(reception?.starts_at)} />
                <Info label="Lokasi akad" value={safeValue(ceremony?.venue_name)} />
                <Info label="Lokasi resepsi" value={safeValue(reception?.venue_name)} />
                <Info label="Alamat" value={safeValue(reception?.address ?? ceremony?.address)} />
              </div>
            )}
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel>
              <PanelHeader eyebrow="Tema & Paket" title="Pilihan produk." />
              <div className="mt-6 space-y-4">
                <Field label="Tema">
                  <select
                    className={controlClassName}
                    onChange={(event) => setDraftTheme(event.target.value)}
                    value={draftTheme}
                  >
                    <option value="">Belum memilih tema</option>
                    {themes.map((theme) => (
                      <option key={theme.slug} value={theme.slug}>
                        {theme.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Paket">
                  <select
                    className={controlClassName}
                    onChange={(event) => setDraftPackage(event.target.value)}
                    value={draftPackage}
                  >
                    <option value="">Belum memilih paket</option>
                    {packages.map((pack) => (
                      <option key={pack.code} value={pack.code}>
                        {pack.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <button
                  className="inline-flex min-h-11 w-full items-center justify-center gap-3 bg-[var(--color-gold)] px-4 text-xs font-semibold uppercase text-black transition hover:bg-[#f4ddb0] disabled:opacity-50"
                  disabled={!activeOrder || saving}
                  onClick={() => void saveOrder()}
                  type="button"
                >
                  <Save size={15} />
                  {saving ? "Menyimpan" : "Simpan order"}
                </button>
              </div>
            </Panel>

            <Panel>
              <PanelHeader eyebrow="Link Preview" title="Akses customer." />
              <div className="mt-6 space-y-4">
                <div className="border border-white/12 bg-black/20 p-4">
                  <p className="break-all text-sm leading-6 text-white/70">
                    {detail?.preview_url || "Belum ada invitation yang terhubung."}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    className="inline-flex min-h-11 items-center justify-center gap-3 border border-white/15 px-4 text-xs font-semibold uppercase text-white/70 transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] disabled:opacity-45"
                    disabled={!detail?.preview_url}
                    onClick={() => void copyPreviewUrl()}
                    type="button"
                  >
                    <Copy size={15} />
                    Copy
                  </button>
                  <a
                    className={cn(
                      "inline-flex min-h-11 items-center justify-center gap-3 border border-white/15 px-4 text-xs font-semibold uppercase text-white/70 transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]",
                      !detail?.preview_url && "pointer-events-none opacity-45",
                    )}
                    href={detail?.preview_url || "#"}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ExternalLink size={15} />
                    Buka
                  </a>
                </div>
                {detail?.invitation?.approval_status === "approved_for_publish" ? (
                  <button
                    className="inline-flex min-h-11 w-full items-center justify-center gap-3 border border-[#d5ad55]/40 bg-[#d5ad55]/10 px-4 text-xs font-semibold uppercase text-[#f4ddb0] transition hover:bg-[#d5ad55]/20 disabled:opacity-50"
                    disabled={saving}
                    onClick={() => void publishFinal()}
                    type="button"
                  >
                    Publish final
                  </button>
                ) : null}
              </div>
            </Panel>
          </div>
        </main>

        <aside className="space-y-6" id="revisi">
          <Panel>
            <PanelHeader eyebrow="Catatan Revisi" title="Timeline." />
            <div className="mt-6 space-y-3">
              <textarea
                className="min-h-28 w-full border border-white/12 bg-black/20 p-3 text-sm text-white outline-none focus:border-[var(--color-gold)]"
                onChange={(event) => setRevisionNote(event.target.value)}
                placeholder="Tulis ringkasan revisi atau final check..."
                value={revisionNote}
              />
              <label className="flex items-center gap-3 text-sm text-white/60">
                <input
                  checked={finalCheck}
                  onChange={(event) => setFinalCheck(event.target.checked)}
                  type="checkbox"
                />
                Tandai sebagai Final Check
              </label>
              <button
                className="inline-flex min-h-11 w-full items-center justify-center gap-3 border border-white/15 px-4 text-xs font-semibold uppercase text-white/70 transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] disabled:opacity-45"
                disabled={!activeOrder || savingRevision}
                onClick={() => void addRevisionNote()}
                type="button"
              >
                <Plus size={15} />
                {savingRevision ? "Menyimpan" : "Tambah catatan"}
              </button>
            </div>
            <div className="mt-6 space-y-3">
              {detail?.revisions.map((revision) => (
                <article className="border border-white/10 bg-black/20 p-4" key={revision.id}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{revision.label}</p>
                    <p className="text-xs text-white/35">
                      {new Date(revision.created_at).toLocaleDateString("id-ID")}
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-white/62">
                    {revision.note || "Tidak ada catatan."}
                  </p>
                  <p className="mt-3 text-xs text-white/35">
                    {revision.created_by_email ?? "system"}
                  </p>
                </article>
              ))}
              {detail && detail.revisions.length === 0 ? (
                <p className="text-sm text-white/45">Belum ada catatan revisi.</p>
              ) : null}
            </div>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="Aset & RSVP" title="Ringkasan." />
            <div className="mt-6 grid gap-px bg-white/10">
              <Info label="Foto utama" value={`${photoTotal} asset`} />
              <Info label="Galeri" value={`${galleryTotal} asset`} />
              <Info
                label="Musik"
                value={backsound?.asset.original_filename || backsound?.asset.public_id || "Belum dipilih"}
              />
              <Info label="RSVP invited" value={String(detail?.rsvp.total_invited ?? 0)} />
              <Info label="RSVP hadir" value={String(detail?.rsvp.total_confirmed ?? 0)} />
              <Info label="RSVP tidak hadir" value={String(detail?.rsvp.total_declined ?? 0)} />
              <Info label="Response rate" value={`${detail?.rsvp.response_rate ?? 0}%`} />
            </div>
            <div className="mt-6">
              <p className="text-xs uppercase text-[var(--color-gold)]">Rekening</p>
              <div className="mt-3 space-y-2">
                {detail?.invitation?.bank_accounts?.length ? (
                  detail.invitation.bank_accounts.map((account, index) => (
                    <div className="border border-white/10 bg-black/20 p-3 text-sm" key={index}>
                      <p className="text-white">{account.bank ?? account.name ?? "Bank account"}</p>
                      <p className="mt-1 text-white/50">
                        {account.number ?? account.account_number ?? "Nomor belum diisi"}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-white/45">Belum ada data rekening.</p>
                )}
              </div>
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <section className="border border-white/12 bg-[#141411] p-5">{children}</section>;
}

function PanelHeader({
  aside,
  eyebrow,
  title,
}: {
  aside?: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs uppercase text-[var(--color-gold)]">{eyebrow}</p>
        <h2 className="mt-3 font-serif text-3xl leading-tight">{title}</h2>
      </div>
      {aside ? <p className="text-xs uppercase text-white/45">{aside}</p> : null}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="bg-[#181815] p-5">
      <p className="text-xs uppercase text-white/45">{label}</p>
      <p className="mt-6 font-serif text-4xl">{value}</p>
    </article>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="text-xs uppercase text-white/45">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#181815] p-4">
      <p className="text-xs uppercase text-white/38">{label}</p>
      <p className="mt-2 break-words text-sm leading-6 text-white/72">{value}</p>
    </div>
  );
}
