"use client";

import { Download, LogOut, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  NetworkAwarePreloader,
  NiskalaPreloader,
  type PreloaderContext,
} from "@/components/site/niskala-preloader";
import { cn } from "@/lib/utils";

import {
  formatCurrency,
  formatDate,
  normalizeCurrencyInput,
  paymentLabels,
  redirectToStaffLogin,
  staffDownload,
  staffFetch,
  type Order,
  type PackageOption,
  type PaymentStatus,
  type StaffSession,
  workflowFor,
  workflowLabels,
} from "./staff-api";

type OrderForm = {
  client_email: string;
  client_name: string;
  client_phone: string;
  package_code: string;
  payment_status: PaymentStatus;
  reference: string;
  total_amount: string;
};

const emptyOrderForm: OrderForm = {
  client_email: "",
  client_name: "",
  client_phone: "",
  package_code: "",
  payment_status: "unpaid",
  reference: "",
  total_amount: "",
};

const controlClassName =
  "min-h-10 w-full border border-white/12 bg-black/20 px-3 text-sm text-white outline-none transition focus:border-[var(--color-gold)]";
const selectClassName = cn(
  controlClassName,
  "cursor-pointer bg-[#0b0b09] text-white [color-scheme:dark]",
);
const optionClassName = "bg-[#0b0b09] text-white";
const ghostButtonClassName =
  "inline-flex min-h-11 items-center gap-3 border border-white/15 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-white/70 transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] disabled:opacity-45";

function nextOrderReference(orders: Order[]): string {
  const maxNumber = orders.reduce((max, order) => {
    const match = /^N(\d+)$/i.exec(order.reference);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `N${String(maxNumber + 1).padStart(3, "0")}`;
}

export function AdminOperations() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [staffSession, setStaffSession] = useState<StaffSession["user"] | null>(null);
  const [search, setSearch] = useState("");
  const [workflowFilter, setWorkflowFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [packageFilter, setPackageFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [orderForm, setOrderForm] = useState<OrderForm>(emptyOrderForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingContext, setSavingContext] = useState<PreloaderContext>("save");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [session, nextOrders, nextPackages] = await Promise.all([
        staffFetch<StaffSession>("/auth/me"),
        staffFetch<Order[]>("/admin/orders"),
        staffFetch<PackageOption[]>("/packages?locale=id"),
      ]);
      setStaffSession(session.user);
      setOrders(nextOrders);
      setPackages(nextPackages);
      setOrderForm((current) => ({
        ...current,
        reference: current.reference || nextOrderReference(nextOrders),
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Dashboard staff gagal dimuat.");
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

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((order) => {
      const workflow = workflowFor(order);
      const matchesSearch =
        !query ||
        [
          order.reference,
          order.client_name,
          order.package_code ?? "",
          order.total_amount,
          paymentLabels[order.payment_status],
          workflow,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesWorkflow = !workflowFilter || workflow === workflowFilter;
      const matchesPayment = !paymentFilter || order.payment_status === paymentFilter;
      const matchesPackage = !packageFilter || order.package_code === packageFilter;
      return matchesSearch && matchesWorkflow && matchesPayment && matchesPackage;
    });
  }, [orders, packageFilter, paymentFilter, search, workflowFilter]);

  const financeSummary = useMemo(() => {
    return orders.reduce(
      (summary, order) => ({
        outstanding: summary.outstanding + Number(order.payment_outstanding ?? order.total_amount),
        pending: summary.pending + Number(order.payment_pending_total ?? 0),
        total: summary.total + Number(order.total_amount || 0),
        valid: summary.valid + Number(order.payment_valid_total ?? 0),
      }),
      { outstanding: 0, pending: 0, total: 0, valid: 0 },
    );
  }, [orders]);

  function openAddOrder() {
    setOrderForm({
      ...emptyOrderForm,
      reference: nextOrderReference(orders),
    });
    setShowAdd(true);
    setError("");
    setNotice("");
  }

  async function createOrder() {
    if (!orderForm.reference.trim() || !orderForm.client_name.trim()) {
      setError("ORDER ID dan CLIENT wajib diisi.");
      return;
    }
    setSavingContext("save");
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const totalAmount = normalizeCurrencyInput(orderForm.total_amount);
      const created = await staffFetch<Order>("/admin/orders", {
        body: JSON.stringify({
          client_email: orderForm.client_email.trim(),
          client_name: orderForm.client_name.trim(),
          client_phone: orderForm.client_phone.trim(),
          currency: "IDR",
          package_code: orderForm.package_code || null,
          payment_status: orderForm.payment_status,
          reference: orderForm.reference.trim(),
          status: "lead",
          total_amount: totalAmount,
        }),
        method: "POST",
      });
      setOrders((current) => [created, ...current]);
      setShowAdd(false);
      setNotice(`Order ${created.reference} dibuat.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Order gagal dibuat.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveOrder(order: Order) {
    const confirmed = window.confirm(
      `Arsipkan order ${order.reference}? Data tidak dihapus permanen.`,
    );
    if (!confirmed) {
      return;
    }
    setSavingContext("save");
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await staffFetch<void>(`/admin/orders/${order.reference}`, { method: "DELETE" });
      setOrders((current) => current.filter((item) => item.reference !== order.reference));
      setNotice(`Order ${order.reference} diarsipkan.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Order gagal diarsipkan.");
    } finally {
      setSaving(false);
    }
  }

  async function exportOrders() {
    setSavingContext("action");
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const blob = await staffDownload("/admin/orders/export");
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `niskala-orders-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setNotice("Export CSV order berhasil disiapkan.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Export CSV order gagal.");
    } finally {
      setSaving(false);
    }
  }

  async function logoutStaff() {
    setSavingContext("logout");
    setSaving(true);
    try {
      await staffFetch<{ ok: boolean }>("/auth/logout", { method: "POST" });
    } catch {
      // Local gate tetap dibersihkan agar staff kembali ke form login.
    } finally {
      setSaving(false);
      redirectToStaffLogin();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.22em] text-[var(--color-gold)]">
            Order History
          </p>
          <p className="mt-2 text-sm text-white/55">
            Tabel utama untuk order customer dari WhatsApp dan pembayaran transfer.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {staffSession ? (
            <p className="text-xs uppercase tracking-[0.14em] text-white/45">
              {staffSession.display_name} / {staffSession.role}
            </p>
          ) : null}
          <button
            className={ghostButtonClassName}
            disabled={loading}
            onClick={() => void loadDashboard()}
            type="button"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
          <button
            className={ghostButtonClassName}
            disabled={saving}
            onClick={logoutStaff}
            type="button"
          >
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </div>

      {error ? <NiskalaPreloader compact description={error} state="error" /> : null}
      {notice ? <NiskalaPreloader compact description={notice} state="success" /> : null}
      {loading ? <NetworkAwarePreloader compact context="refresh" /> : null}
      {saving ? <NetworkAwarePreloader compact context={savingContext} /> : null}

      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="Total Tagihan" value={formatCurrency(financeSummary.total)} />
        <Metric label="Pembayaran Valid" value={formatCurrency(financeSummary.valid)} />
        <Metric label="Menunggu Cek" value={formatCurrency(financeSummary.pending)} />
        <Metric label="Sisa Tagihan" value={formatCurrency(financeSummary.outstanding)} />
      </section>

      <section className="border border-white/12 bg-[#141411]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="inline-flex min-h-10 items-center gap-2 bg-[var(--color-gold)] px-4 text-xs font-semibold uppercase tracking-[0.14em] text-black transition hover:bg-[#f4ddb0]"
              onClick={openAddOrder}
              type="button"
            >
              <Plus size={15} />
              Tambah Order
            </button>
            <button
              className={ghostButtonClassName}
              disabled={saving || loading}
              onClick={() => void exportOrders()}
              type="button"
            >
              <Download size={15} />
              Export CSV
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              className={cn(selectClassName, "w-44")}
              onChange={(event) => setPackageFilter(event.target.value)}
              value={packageFilter}
            >
              <option className={optionClassName} value="">
                Semua paket
              </option>
              {packages.map((item) => (
                <option className={optionClassName} key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              className={cn(selectClassName, "w-48")}
              onChange={(event) => setWorkflowFilter(event.target.value)}
              value={workflowFilter}
            >
              <option className={optionClassName} value="">
                Semua status
              </option>
              {workflowLabels.map((label) => (
                <option className={optionClassName} key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
            <select
              className={cn(selectClassName, "w-44")}
              onChange={(event) => setPaymentFilter(event.target.value)}
              value={paymentFilter}
            >
              <option className={optionClassName} value="">
                Semua bayar
              </option>
              {Object.entries(paymentLabels).map(([value, label]) => (
                <option className={optionClassName} key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <label className="flex min-h-10 w-60 items-center gap-3 border border-white/12 bg-black/20 px-3 text-sm text-white/60">
              <Search size={15} />
              <input
                className="w-full bg-transparent outline-none placeholder:text-white/30"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search here"
                value={search}
              />
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.14em] text-white/45">
              <tr>
                <Th>Order ID</Th>
                <Th>Client</Th>
                <Th>Paket</Th>
                <Th>Harga</Th>
                <Th>Status Pembayaran</Th>
                <Th>Tanggal Order</Th>
                <Th>Status</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-5 py-8 text-white/45" colSpan={8}>
                    Memuat order...
                  </td>
                </tr>
              ) : null}
              {!loading && filteredOrders.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-white/45" colSpan={8}>
                    Belum ada order yang cocok.
                  </td>
                </tr>
              ) : null}
              {filteredOrders.map((order) => (
                <tr className="border-t border-white/10" key={order.reference}>
                  <Td strong>{order.reference}</Td>
                  <Td>{order.client_name}</Td>
                  <Td>{order.package_code ?? "Belum dipilih"}</Td>
                  <Td>{formatCurrency(order.total_amount)}</Td>
                  <Td>
                    <Badge tone={order.payment_status}>
                      {paymentLabels[order.payment_status]}
                    </Badge>
                  </Td>
                  <Td>{formatDate(order.created_at)}</Td>
                  <Td>
                    <Badge tone="status">{workflowFor(order)}</Badge>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Link
                        className="inline-flex min-h-9 items-center border border-white/12 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-white/70 transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
                        href={`/admin/orders/${order.reference}`}
                      >
                        Update
                      </Link>
                      <button
                        className="inline-flex min-h-9 items-center gap-2 border border-white/12 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-white/60 transition hover:border-red-300/60 hover:text-red-200 disabled:opacity-45"
                        disabled={saving}
                        onClick={() => void archiveOrder(order)}
                        type="button"
                      >
                        <Trash2 size={14} />
                        Hapus
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showAdd ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4">
          <section className="w-full max-w-2xl border border-white/12 bg-[#141411] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.22em] text-[var(--color-gold)]">
                  Tambah Order
                </p>
                <h2 className="mt-3 font-serif text-3xl">Input order manual.</h2>
              </div>
              <button
                className="text-sm uppercase tracking-[0.14em] text-white/45 hover:text-white"
                onClick={() => setShowAdd(false)}
                type="button"
              >
                Tutup
              </button>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Field label="Order ID">
                <input
                  className={controlClassName}
                  onChange={(event) =>
                    setOrderForm((current) => ({ ...current, reference: event.target.value }))
                  }
                  value={orderForm.reference}
                />
              </Field>
              <Field label="Client">
                <input
                  className={controlClassName}
                  onChange={(event) =>
                    setOrderForm((current) => ({ ...current, client_name: event.target.value }))
                  }
                  placeholder="Fahri"
                  value={orderForm.client_name}
                />
              </Field>
              <Field label="Email">
                <input
                  className={controlClassName}
                  onChange={(event) =>
                    setOrderForm((current) => ({ ...current, client_email: event.target.value }))
                  }
                  placeholder="client@example.com"
                  type="email"
                  value={orderForm.client_email}
                />
              </Field>
              <Field label="Phone">
                <input
                  className={controlClassName}
                  onChange={(event) =>
                    setOrderForm((current) => ({ ...current, client_phone: event.target.value }))
                  }
                  placeholder="+62812"
                  value={orderForm.client_phone}
                />
              </Field>
              <Field label="Paket">
                <select
                  className={selectClassName}
                  onChange={(event) =>
                    setOrderForm((current) => ({ ...current, package_code: event.target.value }))
                  }
                  value={orderForm.package_code}
                >
                  <option className={optionClassName} value="">
                    Belum memilih paket
                  </option>
                  {packages.map((item) => (
                    <option className={optionClassName} key={item.code} value={item.code}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Harga">
                <input
                  className={controlClassName}
                  onChange={(event) =>
                    setOrderForm((current) => ({ ...current, total_amount: event.target.value }))
                  }
                  placeholder="345000 atau 345.000"
                  value={orderForm.total_amount}
                />
              </Field>
              <Field label="Status Pembayaran">
                <select
                  className={selectClassName}
                  onChange={(event) =>
                    setOrderForm((current) => ({
                      ...current,
                      payment_status: event.target.value as PaymentStatus,
                    }))
                  }
                  value={orderForm.payment_status}
                >
                  {Object.entries(paymentLabels).map(([value, label]) => (
                    <option className={optionClassName} key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <button
              className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-3 bg-[var(--color-gold)] px-4 text-xs font-semibold uppercase tracking-[0.14em] text-black transition hover:bg-[#f4ddb0] disabled:opacity-50"
              disabled={saving}
              onClick={() => void createOrder()}
              type="button"
            >
              <Plus size={15} />
              {saving ? "Menyimpan" : "Tambah Order"}
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-5 py-4 font-semibold">{children}</th>;
}

function Td({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  return (
    <td className={cn("px-5 py-4 text-white/70", strong && "font-semibold text-white")}>
      {children}
    </td>
  );
}

function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: PaymentStatus | "status";
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center px-3 text-xs font-semibold",
        tone === "paid" && "bg-emerald-300/15 text-emerald-200",
        tone === "dp" && "bg-[#d5ad55]/15 text-[#f4ddb0]",
        tone === "unpaid" && "bg-red-300/12 text-red-200",
        tone === "status" && "bg-white/8 text-white/70",
      )}
    >
      {children}
    </span>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.14em] text-white/45">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 bg-[#141411] p-4">
      <p className="text-[0.6rem] uppercase tracking-[0.16em] text-white/40">{label}</p>
      <p className="mt-3 font-serif text-2xl text-white">{value}</p>
    </div>
  );
}
