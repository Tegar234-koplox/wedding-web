"use client";

import { LogOut, Plus, RefreshCw, Save } from "lucide-react";
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

export function AdminOperations() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [orderAuditEvents, setOrderAuditEvents] = useState<AuditEvent[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [themes, setThemes] = useState<ThemeOption[]>([]);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [staffSession, setStaffSession] = useState<StaffSession["user"] | null>(null);
  const [selectedReference, setSelectedReference] = useState<string>("");
  const [draftStatus, setDraftStatus] = useState<string>("");
  const [draftStaff, setDraftStaff] = useState<string>("");
  const [orderForm, setOrderForm] = useState(emptyOrderForm);
  const [formError, setFormError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");

  const selectedOrder = useMemo(
    () => orders.find((order) => order.reference === selectedReference) ?? orders[0],
    [orders, selectedReference],
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

  function selectOrder(order: Order) {
    setSelectedReference(order.reference);
    setDraftStatus(order.status);
    setDraftStaff(order.assigned_staff_username ?? "");
    void loadOrderAudit(order.reference);
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
        nextAuditEvents,
        nextStaffUsers,
        nextThemes,
        nextPackages,
      ] =
        await Promise.all([
          staffFetch<StaffSession>("/auth/me"),
          staffFetch<Metrics>("/admin/dashboard/metrics"),
          staffFetch<Order[]>("/admin/orders"),
          staffFetch<Lead[]>("/admin/leads"),
          staffFetch<AuditEvent[]>("/admin/audit-events"),
          staffFetch<StaffUser[]>("/admin/staff-users"),
          staffFetch<ThemePage>("/themes?locale=id&page_size=50"),
          staffFetch<PackageOption[]>("/packages?locale=id"),
        ]);
      setStaffSession(nextSession.user);
      setMetrics(nextMetrics);
      setOrders(nextOrders);
      setLeads(nextLeads);
      setAuditEvents(nextAuditEvents);
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
        await loadOrderAudit(nextSelected.reference);
      } else {
        setOrderAuditEvents([]);
      }
    } catch (caught) {
      if (caught instanceof StaffFetchError && caught.isAuthError) {
        redirectToLogin();
        return;
      }
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
      setAuditEvents([]);
      setOrderAuditEvents([]);
      setSelectedReference("");
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
      if (caught instanceof StaffFetchError && caught.isAuthError) {
        redirectToLogin();
        return;
      }
      setError(caught instanceof Error ? caught.message : "Order gagal disimpan.");
    } finally {
      setSaving(false);
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
      if (caught instanceof StaffFetchError && caught.isAuthError) {
        redirectToLogin();
        return;
      }
      setError(caught instanceof Error ? caught.message : "Order gagal dibuat.");
    } finally {
      setCreating(false);
    }
  }

  function updateOrderForm(field: OrderFormField, value: string) {
    setFormError("");
    setOrderForm((current) => ({ ...current, [field]: value }));
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
