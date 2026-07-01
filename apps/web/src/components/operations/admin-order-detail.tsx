"use client";

import { ArrowLeft, Copy, ExternalLink, Plus, Save } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import {
  formatCurrency,
  paymentLabels,
  staffFetch,
  type DetailRevision,
  type PackageOption,
  type PaymentStatus,
  type StaffOrderDetail,
  type ThemeOption,
  type ThemePage,
  workflowFor,
  workflowLabels,
  workflowStatusDefaults,
} from "./staff-api";

type OrderDetailForm = {
  bank_account_bank: string;
  bank_account_name: string;
  bank_account_number: string;
  backsound_url: string;
  ceremony_address: string;
  ceremony_map_url: string;
  ceremony_starts_at: string;
  ceremony_venue_name: string;
  client_email: string;
  client_name: string;
  client_phone: string;
  gallery_urls: string;
  package_code: string;
  payment_status: PaymentStatus;
  photo_url: string;
  reception_address: string;
  reception_map_url: string;
  reception_starts_at: string;
  reception_venue_name: string;
  rsvp_declined: string;
  rsvp_invited: string;
  rsvp_confirmed: string;
  status_label: string;
  theme_slug: string;
  total_amount: string;
};

const emptyForm: OrderDetailForm = {
  bank_account_bank: "",
  bank_account_name: "",
  bank_account_number: "",
  backsound_url: "",
  ceremony_address: "",
  ceremony_map_url: "",
  ceremony_starts_at: "",
  ceremony_venue_name: "",
  client_email: "",
  client_name: "",
  client_phone: "",
  gallery_urls: "",
  package_code: "",
  payment_status: "unpaid",
  photo_url: "",
  reception_address: "",
  reception_map_url: "",
  reception_starts_at: "",
  reception_venue_name: "",
  rsvp_declined: "0",
  rsvp_invited: "0",
  rsvp_confirmed: "0",
  status_label: "Baru",
  theme_slug: "",
  total_amount: "0",
};

const controlClassName =
  "min-h-11 w-full border border-white/12 bg-black/20 px-3 text-sm text-white outline-none transition focus:border-[var(--color-gold)]";
const outlineButtonClassName =
  "inline-flex min-h-11 items-center justify-center gap-3 border border-white/15 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-white/70 transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] disabled:opacity-45";

function toDatetimeInput(value?: string | null): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromDetail(detail: StaffOrderDetail): OrderDetailForm {
  const ceremony = detail.events.find((event) => event.event_type === "ceremony");
  const reception = detail.events.find((event) => event.event_type === "reception");
  const account = detail.invitation?.bank_accounts?.[0] ?? {};
  const rsvpManual = detail.invitation?.rsvp_manual ?? {};
  const photo = detail.media.find((item) => item.role === "photo");
  const gallery = detail.media.filter((item) => item.role === "gallery");
  const backsound = detail.media.find((item) => item.role === "backsound");

  return {
    bank_account_bank: account.bank ?? "",
    bank_account_name: account.name ?? "",
    bank_account_number: account.number ?? account.account_number ?? "",
    backsound_url: backsound?.asset.secure_url ?? "",
    ceremony_address: ceremony?.address ?? "",
    ceremony_map_url: ceremony?.map_url ?? "",
    ceremony_starts_at: toDatetimeInput(ceremony?.starts_at),
    ceremony_venue_name: ceremony?.venue_name ?? "",
    client_email: detail.order.client_email ?? "",
    client_name: detail.order.client_name ?? "",
    client_phone: detail.order.client_phone ?? "",
    gallery_urls: gallery.map((item) => item.asset.secure_url).join("\n"),
    package_code: detail.order.package_code ?? detail.invitation?.package_code ?? "",
    payment_status: detail.order.payment_status,
    photo_url: photo?.asset.secure_url ?? "",
    reception_address: reception?.address ?? "",
    reception_map_url: reception?.map_url ?? "",
    reception_starts_at: toDatetimeInput(reception?.starts_at),
    reception_venue_name: reception?.venue_name ?? "",
    rsvp_declined: String(rsvpManual.total_declined ?? detail.rsvp.total_declined ?? 0),
    rsvp_invited: String(rsvpManual.total_invited ?? detail.rsvp.total_invited ?? 0),
    rsvp_confirmed: String(rsvpManual.total_confirmed ?? detail.rsvp.total_confirmed ?? 0),
    status_label: workflowFor(detail.order),
    theme_slug: detail.order.theme_slug ?? detail.invitation?.theme_slug ?? "",
    total_amount: detail.order.total_amount,
  };
}

export function AdminOrderDetail({ reference }: { reference: string }) {
  const [detail, setDetail] = useState<StaffOrderDetail | null>(null);
  const [form, setForm] = useState<OrderDetailForm>(emptyForm);
  const [themes, setThemes] = useState<ThemeOption[]>([]);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [revisionNote, setRevisionNote] = useState("");
  const [finalCheck, setFinalCheck] = useState(false);
  const [revisionEdits, setRevisionEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingRevision, setSavingRevision] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextDetail, nextThemes, nextPackages] = await Promise.all([
        staffFetch<StaffOrderDetail>(`/admin/orders/${reference}`),
        staffFetch<ThemePage>("/themes?locale=id&page_size=50"),
        staffFetch<PackageOption[]>("/packages?locale=id"),
      ]);
      setDetail(nextDetail);
      setForm(fromDetail(nextDetail));
      setThemes(nextThemes.results);
      setPackages(nextPackages);
      setRevisionEdits(
        Object.fromEntries(nextDetail.revisions.map((revision) => [revision.id, revision.note])),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Detail order gagal dimuat.");
    } finally {
      setLoading(false);
    }
  }, [reference]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDetail();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDetail]);

  function updateForm(field: keyof OrderDetailForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveDetail() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const totalInvited = Number(form.rsvp_invited || 0);
      const totalConfirmed = Number(form.rsvp_confirmed || 0);
      const totalDeclined = Number(form.rsvp_declined || 0);
      const responded = totalConfirmed + totalDeclined;
      const responseRate = totalInvited ? Math.round((responded / totalInvited) * 1000) / 10 : 0;
      const updated = await staffFetch<StaffOrderDetail>(`/admin/orders/${reference}`, {
        body: JSON.stringify({
          bank_accounts: [
            {
              bank: form.bank_account_bank.trim(),
              name: form.bank_account_name.trim(),
              number: form.bank_account_number.trim(),
            },
          ].filter((account) => account.bank || account.name || account.number),
          ceremony: {
            address: form.ceremony_address.trim(),
            map_url: form.ceremony_map_url.trim(),
            starts_at: form.ceremony_starts_at,
            venue_name: form.ceremony_venue_name.trim(),
          },
          client_email: form.client_email.trim(),
          client_name: form.client_name.trim(),
          client_phone: form.client_phone.trim(),
          media_urls: {
            backsound: form.backsound_url.trim(),
            gallery: form.gallery_urls
              .split("\n")
              .map((item) => item.trim())
              .filter(Boolean),
            photo: form.photo_url.trim(),
          },
          package_code: form.package_code || null,
          payment_status: form.payment_status,
          reception: {
            address: form.reception_address.trim(),
            map_url: form.reception_map_url.trim(),
            starts_at: form.reception_starts_at,
            venue_name: form.reception_venue_name.trim(),
          },
          rsvp_manual: {
            response_rate: responseRate,
            total_confirmed: totalConfirmed,
            total_declined: totalDeclined,
            total_invited: totalInvited,
          },
          status: workflowStatusDefaults[form.status_label] ?? "lead",
          theme_slug: form.theme_slug || null,
          total_amount: form.total_amount || "0",
        }),
        method: "PATCH",
      });
      setDetail(updated);
      setForm(fromDetail(updated));
      setNotice("Perubahan order tersimpan.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Detail order gagal disimpan.");
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

  async function addRevisionNote() {
    if (!revisionNote.trim()) {
      setError("Catatan revisi wajib diisi.");
      return;
    }
    setSavingRevision(true);
    setError("");
    setNotice("");
    try {
      const updated = await staffFetch<StaffOrderDetail>(`/admin/orders/${reference}/revisions`, {
        body: JSON.stringify({
          is_final_check: finalCheck,
          note: revisionNote.trim(),
        }),
        method: "POST",
      });
      setDetail(updated);
      setRevisionNote("");
      setFinalCheck(false);
      setRevisionEdits(
        Object.fromEntries(updated.revisions.map((revision) => [revision.id, revision.note])),
      );
      setNotice("Catatan revisi ditambahkan.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Catatan revisi gagal ditambahkan.");
    } finally {
      setSavingRevision(false);
    }
  }

  async function saveRevision(revision: DetailRevision) {
    setSavingRevision(true);
    setError("");
    setNotice("");
    try {
      const updated = await staffFetch<StaffOrderDetail>(
        `/admin/orders/${reference}/revisions/${revision.id}`,
        {
          body: JSON.stringify({
            is_final_check: revision.is_final_check,
            note: revisionEdits[revision.id] ?? "",
          }),
          method: "PATCH",
        },
      );
      setDetail(updated);
      setRevisionEdits(
        Object.fromEntries(updated.revisions.map((item) => [item.id, item.note])),
      );
      setNotice("Catatan revisi diperbarui.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Catatan revisi gagal diperbarui.");
    } finally {
      setSavingRevision(false);
    }
  }

  const pricePreview = formatCurrency(form.total_amount || 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          className="inline-flex min-h-11 items-center gap-3 border border-white/15 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-white/70 transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
          href="/admin"
        >
          <ArrowLeft size={15} />
          Kembali
        </Link>
        <button
          className="inline-flex min-h-11 items-center gap-3 bg-[var(--color-gold)] px-4 text-xs font-semibold uppercase tracking-[0.14em] text-black transition hover:bg-[#f4ddb0] disabled:opacity-50"
          disabled={saving || loading}
          onClick={() => void saveDetail()}
          type="button"
        >
          <Save size={15} />
          {saving ? "Menyimpan" : "Simpan Detail"}
        </button>
      </div>

      {error ? <Notice tone="warn">{error}</Notice> : null}
      {notice ? <Notice tone="ok">{notice}</Notice> : null}
      {loading ? <Notice tone="warn">Memuat detail order...</Notice> : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <Panel eyebrow="Status pengerjaan" title={detail?.order.reference ?? reference}>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Status">
                <select
                  className={controlClassName}
                  onChange={(event) => updateForm("status_label", event.target.value)}
                  value={form.status_label}
                >
                  {workflowLabels.map((label) => (
                    <option key={label} value={label}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status Pembayaran">
                <select
                  className={controlClassName}
                  onChange={(event) =>
                    updateForm("payment_status", event.target.value as PaymentStatus)
                  }
                  value={form.payment_status}
                >
                  {Object.entries(paymentLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={`Harga (${pricePreview})`}>
                <input
                  className={controlClassName}
                  onChange={(event) => updateForm("total_amount", event.target.value)}
                  value={form.total_amount}
                />
              </Field>
            </div>
          </Panel>

          <Panel eyebrow="Data Client" title="Informasi customer dan acara.">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Nama">
                <input
                  className={controlClassName}
                  onChange={(event) => updateForm("client_name", event.target.value)}
                  value={form.client_name}
                />
              </Field>
              <Field label="Email">
                <input
                  className={controlClassName}
                  onChange={(event) => updateForm("client_email", event.target.value)}
                  value={form.client_email}
                />
              </Field>
              <Field label="Phone">
                <input
                  className={controlClassName}
                  onChange={(event) => updateForm("client_phone", event.target.value)}
                  value={form.client_phone}
                />
              </Field>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <EventFields
                address={form.ceremony_address}
                mapUrl={form.ceremony_map_url}
                onChange={updateForm}
                startsAt={form.ceremony_starts_at}
                title="Akad"
                venueName={form.ceremony_venue_name}
                prefix="ceremony"
              />
              <EventFields
                address={form.reception_address}
                mapUrl={form.reception_map_url}
                onChange={updateForm}
                startsAt={form.reception_starts_at}
                title="Resepsi"
                venueName={form.reception_venue_name}
                prefix="reception"
              />
            </div>
          </Panel>

          <Panel eyebrow="Tema & Paket" title="Produk undangan.">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Tema">
                <select
                  className={controlClassName}
                  onChange={(event) => updateForm("theme_slug", event.target.value)}
                  value={form.theme_slug}
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
                  onChange={(event) => updateForm("package_code", event.target.value)}
                  value={form.package_code}
                >
                  <option value="">Belum memilih paket</option>
                  {packages.map((pack) => (
                    <option key={pack.code} value={pack.code}>
                      {pack.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Panel>

          <Panel eyebrow="Media" title="Foto, galeri, dan musik.">
            <div className="grid gap-4">
              <Field label="Foto utama Cloudinary URL">
                <input
                  className={controlClassName}
                  onChange={(event) => updateForm("photo_url", event.target.value)}
                  placeholder="https://res.cloudinary.com/..."
                  value={form.photo_url}
                />
              </Field>
              <Field label="Galeri Cloudinary URL (satu URL per baris)">
                <textarea
                  className="min-h-32 w-full border border-white/12 bg-black/20 p-3 text-sm text-white outline-none transition focus:border-[var(--color-gold)]"
                  onChange={(event) => updateForm("gallery_urls", event.target.value)}
                  value={form.gallery_urls}
                />
              </Field>
              <Field label="Musik / backsound Cloudinary URL">
                <input
                  className={controlClassName}
                  onChange={(event) => updateForm("backsound_url", event.target.value)}
                  placeholder="https://res.cloudinary.com/.../song.mp3"
                  value={form.backsound_url}
                />
              </Field>
            </div>
          </Panel>

          <Panel eyebrow="Rekening & RSVP" title="Data operasional.">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Bank">
                <input
                  className={controlClassName}
                  onChange={(event) => updateForm("bank_account_bank", event.target.value)}
                  value={form.bank_account_bank}
                />
              </Field>
              <Field label="Atas nama">
                <input
                  className={controlClassName}
                  onChange={(event) => updateForm("bank_account_name", event.target.value)}
                  value={form.bank_account_name}
                />
              </Field>
              <Field label="Nomor rekening">
                <input
                  className={controlClassName}
                  onChange={(event) => updateForm("bank_account_number", event.target.value)}
                  value={form.bank_account_number}
                />
              </Field>
              <Field label="RSVP invited">
                <input
                  className={controlClassName}
                  onChange={(event) => updateForm("rsvp_invited", event.target.value)}
                  value={form.rsvp_invited}
                />
              </Field>
              <Field label="RSVP hadir">
                <input
                  className={controlClassName}
                  onChange={(event) => updateForm("rsvp_confirmed", event.target.value)}
                  value={form.rsvp_confirmed}
                />
              </Field>
              <Field label="RSVP tidak hadir">
                <input
                  className={controlClassName}
                  onChange={(event) => updateForm("rsvp_declined", event.target.value)}
                  value={form.rsvp_declined}
                />
              </Field>
            </div>
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel eyebrow="Link Preview" title="Sementara customer.">
            <div className="border border-white/12 bg-black/20 p-4">
              <p className="break-all text-sm leading-6 text-white/70">
                {detail?.preview_url || "Pilih tema lalu simpan untuk membuat link preview."}
              </p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <button
                className={outlineButtonClassName}
                disabled={!detail?.preview_url}
                onClick={() => void copyPreviewUrl()}
                type="button"
              >
                <Copy size={15} />
                Copy
              </button>
              <a
                className={cn(
                  outlineButtonClassName,
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
          </Panel>

          <Panel eyebrow="Catatan Revisi" title="Timeline.">
            <textarea
              className="min-h-28 w-full border border-white/12 bg-black/20 p-3 text-sm text-white outline-none transition focus:border-[var(--color-gold)]"
              onChange={(event) => setRevisionNote(event.target.value)}
              placeholder="Tulis revisi atau final check..."
              value={revisionNote}
            />
            <label className="mt-3 flex items-center gap-3 text-sm text-white/60">
              <input
                checked={finalCheck}
                onChange={(event) => setFinalCheck(event.target.checked)}
                type="checkbox"
              />
              Final Check
            </label>
            <button
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-3 border border-white/15 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-white/70 transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] disabled:opacity-45"
              disabled={savingRevision}
              onClick={() => void addRevisionNote()}
              type="button"
            >
              <Plus size={15} />
              Tambah Catatan
            </button>
            <div className="mt-6 space-y-3">
              {detail?.revisions.map((revision) => (
                <article className="border border-white/10 bg-black/20 p-4" key={revision.id}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{revision.label}</p>
                    <p className="text-xs text-white/35">
                      {new Date(revision.created_at).toLocaleDateString("id-ID")}
                    </p>
                  </div>
                  <textarea
                    className="mt-3 min-h-20 w-full border border-white/10 bg-black/20 p-3 text-sm text-white/70 outline-none transition focus:border-[var(--color-gold)]"
                    onChange={(event) =>
                      setRevisionEdits((current) => ({
                        ...current,
                        [revision.id]: event.target.value,
                      }))
                    }
                    value={revisionEdits[revision.id] ?? ""}
                  />
                  <button
                    className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-gold)]"
                    disabled={savingRevision}
                    onClick={() => void saveRevision(revision)}
                    type="button"
                  >
                    Simpan revisi
                  </button>
                </article>
              ))}
            </div>
          </Panel>
        </aside>
      </section>
    </div>
  );
}

function EventFields({
  address,
  mapUrl,
  onChange,
  prefix,
  startsAt,
  title,
  venueName,
}: {
  address: string;
  mapUrl: string;
  onChange: (field: keyof OrderDetailForm, value: string) => void;
  prefix: "ceremony" | "reception";
  startsAt: string;
  title: string;
  venueName: string;
}) {
  return (
    <div className="border border-white/10 bg-black/20 p-4">
      <p className="mb-4 text-xs uppercase tracking-[0.16em] text-[var(--color-gold)]">
        {title}
      </p>
      <div className="grid gap-3">
        <Field label="Tanggal & waktu">
          <input
            className={controlClassName}
            onChange={(event) =>
              onChange(`${prefix}_starts_at` as keyof OrderDetailForm, event.target.value)
            }
            type="datetime-local"
            value={startsAt}
          />
        </Field>
        <Field label="Lokasi / Venue">
          <input
            className={controlClassName}
            onChange={(event) =>
              onChange(`${prefix}_venue_name` as keyof OrderDetailForm, event.target.value)
            }
            value={venueName}
          />
        </Field>
        <Field label="Alamat">
          <textarea
            className="min-h-20 w-full border border-white/12 bg-black/20 p-3 text-sm text-white outline-none transition focus:border-[var(--color-gold)]"
            onChange={(event) =>
              onChange(`${prefix}_address` as keyof OrderDetailForm, event.target.value)
            }
            value={address}
          />
        </Field>
        <Field label="Map URL">
          <input
            className={controlClassName}
            onChange={(event) =>
              onChange(`${prefix}_map_url` as keyof OrderDetailForm, event.target.value)
            }
            value={mapUrl}
          />
        </Field>
      </div>
    </div>
  );
}

function Panel({
  children,
  eyebrow,
  title,
}: {
  children: ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <section className="border border-white/12 bg-[#141411] p-5">
      <p className="text-[0.65rem] uppercase tracking-[0.22em] text-[var(--color-gold)]">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-serif text-3xl leading-tight">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
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

function Notice({ children, tone }: { children: ReactNode; tone: "ok" | "warn" }) {
  return (
    <div
      className={cn(
        "border p-4 text-sm leading-6",
        tone === "ok"
          ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
          : "border-[#d5ad55]/40 bg-[#d5ad55]/10 text-[#f4ddb0]",
      )}
    >
      {children}
    </div>
  );
}
