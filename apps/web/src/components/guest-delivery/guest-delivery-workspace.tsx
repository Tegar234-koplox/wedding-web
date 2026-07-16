"use client";

import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Search,
  Send,
  Upload,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

type GuestDeliveryMode = "import" | "list" | "wishes";

type GuestDeliveryDetail = {
  token: string;
  invitation: {
    public_slug: string;
    status: string;
    approval_status: string;
    couple_name: string;
    theme_name: string;
    package_name: string;
  };
  rsvp: {
    total_invited: number;
    total_confirmed: number;
    total_declined: number;
    response_rate: number;
  };
  delivery: {
    total_guests: number;
    sent_count: number;
    not_sent_count: number;
  };
};

type GuestDeliveryLink = {
  id: string;
  display_name: string;
  email: string;
  phone: string;
  party_size: number;
  rsvp_status: string;
  attendance_count: number;
  delivery_url: string | null;
  delivery_status: "sent" | "not_sent" | string;
  delivery_sent_at: string | null;
};

type GuestImportRow = {
  row_number: number;
  name: string;
  phone: string;
  email: string;
  party_size: number;
  status: string;
  action: string;
  errors: string[];
  warnings: string[];
};

type GuestImportResult = {
  summary: {
    total_rows: number;
    valid_rows: number;
    error_rows: number;
    warning_rows: number;
    created_count: number;
    updated_count: number;
    skipped_count: number;
  };
  rows: GuestImportRow[];
};

type GuestWish = {
  display_name: string;
  rsvp_status: string;
  attendance_count: number;
  wishes: string;
  responded_at: string | null;
};

type GuestWishesPayload = {
  public_slug: string;
  couple_name: string;
  total_invited: number;
  total_confirmed: number;
  total_declined: number;
  total_pending: number;
  response_rate: number;
  wishes: GuestWish[];
};

type GuestForm = {
  display_name: string;
  email: string;
  phone: string;
  party_size: string;
};

const emptyGuestForm: GuestForm = {
  display_name: "",
  email: "",
  phone: "",
  party_size: "1",
};

const controlClassName =
  "w-full border border-white/15 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-gold)]";

const outlineButtonClassName =
  "inline-flex min-h-11 items-center justify-center gap-3 border border-white/15 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] disabled:cursor-not-allowed disabled:opacity-45";

const primaryButtonClassName =
  "inline-flex min-h-11 items-center justify-center gap-3 bg-[var(--color-gold)] px-4 text-xs font-semibold uppercase tracking-[0.14em] text-black transition hover:bg-[#f4ddb0] disabled:cursor-not-allowed disabled:opacity-45";

function guestManagementUrl(token: string, path = ""): string {
  return `/api/guest-management/${encodeURIComponent(token)}${path}`;
}

async function guestFetch<T>(token: string, path = "", init?: RequestInit): Promise<T> {
  const response = await fetch(guestManagementUrl(token, path), {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const payload = (await response.json()) as { detail?: string; error?: { message?: string } };
      detail = payload.detail ?? payload.error?.message ?? detail;
    } catch {
      // Keep HTTP status text.
    }
    throw new Error(`Request gagal (${response.status})${detail ? `: ${detail}` : ""}`);
  }

  return response.json() as Promise<T>;
}

async function guestDownload(token: string, path: string): Promise<Blob> {
  const response = await fetch(guestManagementUrl(token, path), {
    cache: "no-store",
    headers: { Accept: "*/*" },
  });
  if (!response.ok) {
    throw new Error(`Download gagal (${response.status})`);
  }
  return response.blob();
}

async function guestUpload<T>(token: string, path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(guestManagementUrl(token, path), {
    body: formData,
    cache: "no-store",
    headers: { Accept: "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const payload = (await response.json()) as { detail?: string; file?: string[] };
      detail = payload.detail ?? payload.file?.join(" ") ?? detail;
    } catch {
      // Keep HTTP status text.
    }
    throw new Error(`Upload gagal (${response.status})${detail ? `: ${detail}` : ""}`);
  }
  return response.json() as Promise<T>;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function rsvpLabel(status: string): string {
  if (status === "accepted") {
    return "Hadir";
  }
  if (status === "declined") {
    return "Tidak hadir";
  }
  return "Belum RSVP";
}

function formatRespondedAt(value: string | null): string {
  if (!value) {
    return "Belum ada waktu";
  }
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function whatsappUrl(guest: GuestDeliveryLink): string {
  const digits = guest.phone.replace(/\D/g, "");
  const message = [
    `Halo ${guest.display_name},`,
    "",
    "Kami mengundang Anda melalui link undangan personal berikut:",
    guest.delivery_url ?? "",
    "",
    "Mohon konfirmasi kehadiran melalui form RSVP di dalam undangan.",
  ]
    .filter(Boolean)
    .join("\n");
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : "#";
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-white/10 bg-white/[0.025] p-4">
      <p className="text-[0.62rem] uppercase tracking-[0.16em] text-white/40">{label}</p>
      <p className="mt-2 font-serif text-3xl text-white">{value}</p>
    </div>
  );
}

export function GuestDeliveryWorkspace({
  mode,
  token,
}: {
  mode: GuestDeliveryMode;
  token: string;
}) {
  const [detail, setDetail] = useState<GuestDeliveryDetail | null>(null);
  const [guests, setGuests] = useState<GuestDeliveryLink[]>([]);
  const [wishes, setWishes] = useState<GuestWishesPayload | null>(null);
  const [query, setQuery] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<GuestImportResult | null>(null);
  const [form, setForm] = useState<GuestForm>(emptyGuestForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadWorkspace = useCallback(async () => {
    setError("");
    try {
      const [nextDetail, nextGuests, nextWishes] = await Promise.all([
        guestFetch<GuestDeliveryDetail>(token),
        guestFetch<GuestDeliveryLink[]>(token, "/guest-links"),
        guestFetch<GuestWishesPayload>(token, "/wishes"),
      ]);
      setDetail(nextDetail);
      setGuests(nextGuests);
      setWishes(nextWishes);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Halaman daftar tamu gagal dimuat.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadWorkspace();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadWorkspace]);

  const filteredGuests = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return guests;
    }
    return guests.filter((guest) => guest.display_name.toLowerCase().includes(normalized));
  }, [guests, query]);
  const importHref = `/guest-delivery/${encodeURIComponent(token)}` as Route;
  const listHref = `/guest-delivery/${encodeURIComponent(token)}/guests` as Route;
  const wishesHref = `/guest-delivery/${encodeURIComponent(token)}/wishes` as Route;

  function updateForm(field: keyof GuestForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function downloadTemplate() {
    setError("");
    try {
      const blob = await guestDownload(token, "/guest-links/import-template");
      downloadBlob(blob, "template-daftar-tamu.csv");
      setNotice("Template CSV berhasil didownload.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Template CSV gagal didownload.");
    }
  }

  async function exportCsv() {
    setError("");
    try {
      const blob = await guestDownload(token, "/guest-links/export");
      downloadBlob(blob, "daftar-link-tamu.csv");
      setNotice("CSV daftar link personal berhasil didownload.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Export CSV gagal.");
    }
  }

  async function importCsv(dryRun: boolean) {
    if (!file) {
      setError("Pilih atau tarik file CSV terlebih dahulu.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await guestUpload<GuestImportResult>(
        token,
        `/guest-links/import${dryRun ? "?dry_run=true" : ""}`,
        file,
      );
      setPreview(result);
      if (dryRun) {
        setNotice(
          `Preview selesai: ${result.summary.valid_rows} baris siap, ${result.summary.error_rows} perlu diperbaiki.`,
        );
      } else {
        await loadWorkspace();
        setNotice(
          `Import selesai: ${result.summary.created_count} tamu baru, ${result.summary.updated_count} diperbarui.`,
        );
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import CSV gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function createGuest() {
    if (!form.display_name.trim()) {
      setError("Nama tamu wajib diisi.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const guest = await guestFetch<GuestDeliveryLink>(token, "/guest-links", {
        body: JSON.stringify({
          display_name: form.display_name.trim(),
          email: form.email.trim(),
          party_size: Number(form.party_size || 1),
          phone: form.phone.trim(),
        }),
        method: "POST",
      });
      setGuests((current) => [...current, guest]);
      setForm(emptyGuestForm);
      setNotice("Link tamu berhasil dibuat.");
      await loadWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Link tamu gagal dibuat.");
    } finally {
      setBusy(false);
    }
  }

  async function copyText(text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(successMessage);
    } catch {
      setError("Gagal menyalin. Silakan copy manual dari layar.");
    }
  }

  async function toggleSent(guest: GuestDeliveryLink) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const updated = await guestFetch<GuestDeliveryLink>(
        token,
        `/guest-links/${guest.id}/delivery`,
        {
          body: JSON.stringify({ sent: guest.delivery_status !== "sent" }),
          method: "PATCH",
        },
      );
      setGuests((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      await loadWorkspace();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Status pengiriman gagal diperbarui.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--color-black)] px-6 py-12 text-white">
        <p className="text-sm text-white/60">Memuat daftar tamu...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-black)] px-6 py-10 text-white md:px-12">
      <header className="mx-auto flex max-w-6xl flex-col gap-8 border-b border-white/10 pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[0.66rem] uppercase tracking-[0.34em] text-[var(--color-gold)]">
            Daftar Link Personal
          </p>
          <h1 className="mt-4 max-w-3xl font-serif text-5xl leading-none md:text-7xl">
            {detail?.invitation.couple_name ?? "Daftar tamu."}
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-white/65">
            Kelola link undangan personal untuk tamu. Tamu tidak perlu membuat akun; cukup buka
            link personal, lalu isi RSVP di undangan.
          </p>
        </div>
        <nav className="flex flex-wrap gap-3">
          <Link
            className={cn(
              outlineButtonClassName,
              mode === "import" && "border-[var(--color-gold)] text-[var(--color-gold)]",
            )}
            href={importHref}
          >
            Import CSV
          </Link>
          <Link
            className={cn(
              outlineButtonClassName,
              mode === "list" && "border-[var(--color-gold)] text-[var(--color-gold)]",
            )}
            href={listHref}
          >
            Daftar Tamu
          </Link>
          <Link
            className={cn(
              outlineButtonClassName,
              mode === "wishes" && "border-[var(--color-gold)] text-[var(--color-gold)]",
            )}
            href={wishesHref}
          >
            Ucapan Tamu
          </Link>
        </nav>
      </header>

      <section className="mx-auto mt-8 grid max-w-6xl gap-3 md:grid-cols-4">
        <StatCard label="Total Tamu" value={detail?.delivery.total_guests ?? 0} />
        <StatCard label="Sudah Dikirim" value={detail?.delivery.sent_count ?? 0} />
        <StatCard label="Belum Dikirim" value={detail?.delivery.not_sent_count ?? 0} />
        <StatCard label="RSVP Hadir" value={detail?.rsvp.total_confirmed ?? 0} />
      </section>

      {error ? (
        <div className="mx-auto mt-6 max-w-6xl border border-[var(--color-gold)]/45 bg-[var(--color-gold)]/10 p-4 text-sm text-[#ffe8a3]">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="mx-auto mt-6 max-w-6xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          {notice}
        </div>
      ) : null}

      {mode === "import" ? (
        <section className="mx-auto mt-8 grid max-w-6xl gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="border border-white/10 bg-white/[0.025] p-5">
            <p className="text-[0.66rem] uppercase tracking-[0.24em] text-[var(--color-gold)]">
              Panduan
            </p>
            <h2 className="mt-3 font-serif text-3xl">Cara isi daftar tamu.</h2>
            <ol className="mt-5 space-y-4 text-sm leading-7 text-white/65">
              <li>1. Download template CSV dari tombol di samping.</li>
              <li>2. Buka file di Excel atau Google Sheets.</li>
              <li>3. Isi kolom nama tamu. Nomor WhatsApp dan email boleh dikosongkan.</li>
              <li>4. Kolom jumlah berarti kuota orang untuk satu link, misalnya 2 untuk pasangan.</li>
              <li>5. Simpan/download kembali sebagai CSV, lalu upload di halaman ini.</li>
              <li>6. Klik preview dulu. Kalau tidak ada error, baru klik import.</li>
            </ol>
            <div className="mt-6 grid gap-3">
              <button className={outlineButtonClassName} onClick={() => void downloadTemplate()} type="button">
                <FileSpreadsheet size={15} />
                Download Template CSV
              </button>
              <button className={outlineButtonClassName} onClick={() => void exportCsv()} type="button">
                <Download size={15} />
                Export CSV
              </button>
            </div>
          </div>

          <div className="border border-white/10 bg-white/[0.025] p-5">
            <p className="text-[0.66rem] uppercase tracking-[0.24em] text-[var(--color-gold)]">
              Import
            </p>
            <h2 className="mt-3 font-serif text-3xl">Upload daftar tamu.</h2>
            <label
              className={cn(
                "mt-5 flex min-h-44 cursor-pointer flex-col items-center justify-center border border-dashed border-white/20 bg-black/20 p-6 text-center transition",
                dragging && "border-[var(--color-gold)] bg-[var(--color-gold)]/10",
              )}
              onDragLeave={() => setDragging(false)}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                setFile(event.dataTransfer.files?.[0] ?? null);
                setPreview(null);
              }}
            >
              <Upload className="text-[var(--color-gold)]" size={28} />
              <span className="mt-3 text-sm text-white">
                {file ? file.name : "Tarik file CSV ke sini atau klik untuk pilih file"}
              </span>
              <span className="mt-2 text-xs text-white/45">Format yang diterima: .csv</span>
              <input
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setPreview(null);
                }}
                type="file"
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                className={outlineButtonClassName}
                disabled={busy || !file}
                onClick={() => void importCsv(true)}
                type="button"
              >
                Preview CSV
              </button>
              <button
                className={primaryButtonClassName}
                disabled={busy || !file}
                onClick={() => void importCsv(false)}
                type="button"
              >
                Import Tamu
              </button>
            </div>

            {preview ? (
              <div className="mt-6 space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <StatCard label="Rows" value={preview.summary.total_rows} />
                  <StatCard label="Valid" value={preview.summary.valid_rows} />
                  <StatCard label="Warning" value={preview.summary.warning_rows} />
                  <StatCard label="Error" value={preview.summary.error_rows} />
                </div>
                <div className="max-h-72 overflow-auto border border-white/10">
                  <table className="w-full min-w-[720px] border-collapse text-left text-xs">
                    <thead className="bg-white/[0.03] uppercase tracking-[0.14em] text-white/45">
                      <tr>
                        <th className="px-3 py-3">Row</th>
                        <th className="px-3 py-3">Nama</th>
                        <th className="px-3 py-3">Kontak</th>
                        <th className="px-3 py-3">Jumlah</th>
                        <th className="px-3 py-3">Catatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.slice(0, 80).map((row) => (
                        <tr className="border-t border-white/10" key={row.row_number}>
                          <td className="px-3 py-3 text-white/45">{row.row_number}</td>
                          <td className="px-3 py-3 text-white">{row.name || "-"}</td>
                          <td className="px-3 py-3 text-white/60">
                            {[row.phone, row.email].filter(Boolean).join(" / ") || "-"}
                          </td>
                          <td className="px-3 py-3 text-white/60">{row.party_size}</td>
                          <td className="px-3 py-3 text-white/55">
                            {[...row.errors, ...row.warnings].join(" ") || row.action}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>

          <div className="border border-white/10 bg-white/[0.025] p-5 lg:col-span-2">
            <p className="text-[0.66rem] uppercase tracking-[0.24em] text-[var(--color-gold)]">
              Tambah Manual
            </p>
            <h2 className="mt-3 font-serif text-3xl">Untuk satu atau dua tamu.</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_0.5fr]">
              <input
                className={controlClassName}
                onChange={(event) => updateForm("display_name", event.target.value)}
                placeholder="Nama tamu"
                value={form.display_name}
              />
              <input
                className={controlClassName}
                onChange={(event) => updateForm("phone", event.target.value)}
                placeholder="WhatsApp"
                value={form.phone}
              />
              <input
                className={controlClassName}
                min={1}
                onChange={(event) => updateForm("party_size", event.target.value)}
                placeholder="Jumlah"
                type="number"
                value={form.party_size}
              />
              <input
                className={controlClassName}
                onChange={(event) => updateForm("email", event.target.value)}
                placeholder="Email opsional"
                type="email"
                value={form.email}
              />
              <button
                className={primaryButtonClassName}
                disabled={busy}
                onClick={() => void createGuest()}
                type="button"
              >
                Tambah Link Tamu
              </button>
            </div>
          </div>
        </section>
      ) : mode === "list" ? (
        <section className="mx-auto mt-8 max-w-6xl border border-white/10 bg-white/[0.025]">
          <div className="flex flex-col gap-4 border-b border-white/10 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[0.66rem] uppercase tracking-[0.24em] text-[var(--color-gold)]">
                Tracking Delivery
              </p>
              <h2 className="mt-2 font-serif text-3xl">Daftar tamu.</h2>
            </div>
            <div className="flex flex-col gap-3 md:flex-row">
              <label className="flex min-h-11 items-center gap-3 border border-white/15 bg-black/30 px-4">
                <Search size={15} className="text-white/45" />
                <input
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari nama tamu"
                  value={query}
                />
              </label>
              <button className={outlineButtonClassName} onClick={() => void exportCsv()} type="button">
                <Download size={15} />
                Export CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.14em] text-white/45">
                <tr>
                  <th className="px-5 py-4">Tamu</th>
                  <th className="px-5 py-4">Kontak</th>
                  <th className="px-5 py-4">RSVP</th>
                  <th className="px-5 py-4">Link</th>
                  <th className="px-5 py-4">Delivery</th>
                  <th className="px-5 py-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredGuests.length === 0 ? (
                  <tr>
                    <td className="px-5 py-8 text-white/45" colSpan={6}>
                      Belum ada tamu yang cocok. Tambahkan atau import daftar tamu di halaman
                      Import CSV.
                    </td>
                  </tr>
                ) : null}
                {filteredGuests.map((guest) => (
                  <tr className="border-t border-white/10" key={guest.id}>
                    <td className="px-5 py-5">
                      <p className="font-semibold text-white">{guest.display_name}</p>
                      <p className="mt-1 text-xs text-white/45">Kuota {guest.party_size} orang</p>
                    </td>
                    <td className="px-5 py-5 text-white/60">
                      {[guest.email, guest.phone].filter(Boolean).join(" / ") || "-"}
                    </td>
                    <td className="px-5 py-5 text-white/60">
                      {rsvpLabel(guest.rsvp_status)}
                      {guest.attendance_count ? ` / ${guest.attendance_count} hadir` : ""}
                    </td>
                    <td className="max-w-[16rem] px-5 py-5">
                      <p className="truncate text-white/50">{guest.delivery_url ?? "-"}</p>
                    </td>
                    <td className="px-5 py-5">
                      <button
                        className={cn(
                          "inline-flex min-h-10 items-center gap-2 border px-3 text-xs font-semibold uppercase tracking-[0.12em] transition",
                          guest.delivery_status === "sent"
                            ? "border-emerald-300/35 bg-emerald-400/10 text-emerald-100"
                            : "border-white/15 text-white/65 hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]",
                        )}
                        disabled={busy}
                        onClick={() => void toggleSent(guest)}
                        type="button"
                      >
                        <CheckCircle2 size={14} />
                        {guest.delivery_status === "sent" ? "Sudah Dikirim" : "Belum Dikirim"}
                      </button>
                    </td>
                    <td className="px-5 py-5">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className={outlineButtonClassName}
                          disabled={!guest.delivery_url}
                          onClick={() =>
                            void copyText(guest.delivery_url ?? "", "Link tamu disalin.")
                          }
                          type="button"
                        >
                          <Copy size={14} />
                          Link
                        </button>
                        <a
                          className={cn(
                            outlineButtonClassName,
                            (!guest.delivery_url || !guest.phone) && "pointer-events-none opacity-45",
                          )}
                          href={whatsappUrl(guest)}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <Send size={14} />
                          WA
                        </a>
                        {guest.delivery_url ? (
                          <a
                            className={outlineButtonClassName}
                            href={guest.delivery_url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <ExternalLink size={14} />
                            Buka
                          </a>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="mx-auto mt-8 max-w-6xl">
          <div className="grid gap-6 border border-white/10 bg-white/[0.025] p-5 lg:grid-cols-[1fr_0.9fr] lg:items-end">
            <div>
              <p className="text-[0.66rem] uppercase tracking-[0.24em] text-[var(--color-gold)]">
                RSVP & Ucapan
              </p>
              <h2 className="mt-3 font-serif text-4xl">Ucapan tamu.</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60">
                Rekap ini hanya untuk client. Data kontak tamu tidak ditampilkan di halaman ucapan,
                hanya nama, status RSVP, jumlah hadir, dan ucapan yang mereka tulis.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <StatCard label="Tamu" value={wishes?.total_invited ?? 0} />
              <StatCard label="Respons" value={`${wishes?.response_rate ?? 0}%`} />
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Hadir" value={wishes?.total_confirmed ?? 0} />
            <StatCard label="Tidak Hadir" value={wishes?.total_declined ?? 0} />
            <StatCard label="Belum RSVP" value={wishes?.total_pending ?? 0} />
            <StatCard label="Ucapan Masuk" value={wishes?.wishes.length ?? 0} />
          </div>

          <div className="mt-6 grid gap-4">
            {!wishes || wishes.wishes.length === 0 ? (
              <div className="border border-white/10 bg-white/[0.03] p-6 text-sm text-white/55">
                Belum ada ucapan yang masuk.
              </div>
            ) : null}

            {wishes?.wishes.map((wish, index) => (
              <article
                className="border border-white/10 bg-white/[0.03] p-5 sm:p-6"
                key={`${wish.display_name}-${wish.responded_at ?? index}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-serif text-2xl text-[#f8f3ea]">{wish.display_name}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--color-gold)]">
                      {rsvpLabel(wish.rsvp_status)}
                      {wish.attendance_count ? ` / ${wish.attendance_count} jumlah hadir` : ""}
                    </p>
                  </div>
                  <p className="text-xs text-white/35">
                    {formatRespondedAt(wish.responded_at)}
                  </p>
                </div>
                <p className="mt-5 max-w-3xl text-base leading-8 text-white/72">
                  {wish.wishes}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
