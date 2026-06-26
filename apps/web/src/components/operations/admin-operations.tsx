"use client";

import { RefreshCw, Save } from "lucide-react";
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

type AuditEvent = {
  id: string;
  actor_email: string | null;
  action: string;
  resource_type: string;
  resource_reference: string;
  created_at: string;
};

type StaffUser = {
  username: string;
  email: string;
  role: string;
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

let cachedCsrfToken = "";

async function csrfToken(): Promise<string> {
  if (cachedCsrfToken) {
    return cachedCsrfToken;
  }
  const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/auth/csrf`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`CSRF request failed with ${response.status}`);
  }
  const payload = (await response.json()) as { csrfToken: string };
  cachedCsrfToken = payload.csrfToken;
  return cachedCsrfToken;
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
    throw new Error(`Staff API failed with ${response.status}`);
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
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [selectedReference, setSelectedReference] = useState<string>("");
  const [draftStatus, setDraftStatus] = useState<string>("");
  const [draftStaff, setDraftStaff] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");

  const selectedOrder = useMemo(
    () => orders.find((order) => order.reference === selectedReference) ?? orders[0],
    [orders, selectedReference],
  );

  function selectOrder(order: Order) {
    setSelectedReference(order.reference);
    setDraftStatus(order.status);
    setDraftStaff(order.assigned_staff_username ?? "");
  }

  const loadDashboard = useCallback(async (preferredReference = "") => {
    setLoading(true);
    setError("");
    try {
      const [nextMetrics, nextOrders, nextLeads, nextAuditEvents, nextStaffUsers] =
        await Promise.all([
          staffFetch<Metrics>("/admin/dashboard/metrics"),
          staffFetch<Order[]>("/admin/orders"),
          staffFetch<Lead[]>("/admin/leads"),
          staffFetch<AuditEvent[]>("/admin/audit-events"),
          staffFetch<StaffUser[]>("/admin/staff-users"),
        ]);
      setMetrics(nextMetrics);
      setOrders(nextOrders);
      setLeads(nextLeads);
      setAuditEvents(nextAuditEvents);
      setStaffUsers(nextStaffUsers);
      const nextSelected =
        nextOrders.find((order) => order.reference === preferredReference) ??
        nextOrders[0];
      if (nextSelected) {
        setSelectedReference(nextSelected.reference);
        setDraftStatus(nextSelected.status);
        setDraftStaff(nextSelected.assigned_staff_username ?? "");
      }
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
      const nextAuditEvents = await staffFetch<AuditEvent[]>(
        `/admin/audit-events?resource_type=order&resource_reference=${updated.reference}`,
      );
      setAuditEvents(nextAuditEvents);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Order gagal disimpan.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.2em] text-[var(--color-gold)]">
            Live Staff Data
          </p>
          <p className="mt-2 text-sm text-white/55">
            Membutuhkan session staff Django yang aktif.
          </p>
        </div>
        <button
          className="inline-flex min-h-11 items-center gap-3 border border-white/15 px-4 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white/70 transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
          disabled={loading}
          onClick={() => void loadDashboard(selectedReference)}
          type="button"
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="border border-[#d5ad55]/40 bg-[#d5ad55]/10 p-5 text-sm leading-6 text-[#f4ddb0]">
          {error}. Login ke Django admin/API sebagai staff, lalu refresh halaman ini.
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
                {!loading && orders.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-white/45" colSpan={5}>
                      Belum ada order.
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
                <p className="mt-3 text-xs uppercase tracking-[0.14em] text-white/40">
                  {lead.source || "direct"} / {lead.campaign || "no campaign"}
                </p>
              </article>
            ))}
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
          </div>
        </section>
      </div>
    </div>
  );
}
