"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  MessageCircle,
  Plus,
  Save,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import {
  customStatusLabels,
  formatCurrency,
  manualPaymentMethodLabels,
  manualPaymentReviewLabels,
  manualPaymentTypeLabels,
  normalizeCurrencyInput,
  paymentLabels,
  staffFetch,
  type CustomStatus,
  type DetailRevision,
  type GuestDeliveryLink,
  type ManualPaymentMethod,
  type ManualPaymentRecord,
  type ManualPaymentReviewStatus,
  type ManualPaymentType,
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
  custom_approval_notes: string;
  custom_brief: string;
  custom_checklist_assets: boolean;
  custom_checklist_copy: boolean;
  custom_checklist_final: boolean;
  custom_checklist_motion: boolean;
  custom_checklist_overlay: boolean;
  custom_checklist_parallax: boolean;
  custom_status: CustomStatus;
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

type PaymentRecordForm = {
  amount: string;
  method: ManualPaymentMethod;
  note: string;
  paid_at: string;
  payment_type: ManualPaymentType;
  proof_url: string;
  rejection_reason: string;
  review_status: ManualPaymentReviewStatus;
};

type MediaSectionPlan = {
  count: number;
  description: string;
  label: string;
  section: number;
};

type ChecklistItem = {
  done: boolean;
  label: string;
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
  custom_approval_notes: "",
  custom_brief: "",
  custom_checklist_assets: false,
  custom_checklist_copy: false,
  custom_checklist_final: false,
  custom_checklist_motion: false,
  custom_checklist_overlay: false,
  custom_checklist_parallax: false,
  custom_status: "none",
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

const emptyPaymentRecordForm: PaymentRecordForm = {
  amount: "",
  method: "bank_transfer",
  note: "",
  paid_at: "",
  payment_type: "dp",
  proof_url: "",
  rejection_reason: "",
  review_status: "pending",
};

const controlClassName =
  "min-h-11 w-full border border-white/12 bg-black/20 px-3 text-sm text-white outline-none transition focus:border-[var(--color-gold)]";
const selectClassName = cn(
  controlClassName,
  "cursor-pointer bg-[#0b0b09] text-white [color-scheme:dark]",
);
const optionClassName = "bg-[#0b0b09] text-white";
const outlineButtonClassName =
  "inline-flex min-h-11 items-center justify-center gap-3 border border-white/15 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-white/70 transition hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] disabled:opacity-45";

const mediaSectionPlans: Record<string, MediaSectionPlan[]> = {
  couture: [
    { count: 3, description: "Foto pembuka setelah waktu dan tempat.", label: "3 foto", section: 2 },
    { count: 3, description: "Foto setelah love story bagian 01-03.", label: "3 foto", section: 4 },
    { count: 3, description: "Foto setelah love story bagian 04-06.", label: "3 foto", section: 6 },
    { count: 3, description: "Foto setelah love story bagian 07-09.", label: "3 foto", section: 8 },
    { count: 3, description: "Foto setelah love story bagian 10-12.", label: "3 foto", section: 10 },
    { count: 3, description: "Foto sebelum prakiraan cuaca dan RSVP.", label: "3 foto", section: 12 },
  ],
  essential: [
    { count: 3, description: "Foto setelah informasi acara dan lokasi.", label: "3 foto", section: 2 },
    { count: 3, description: "Foto setelah short love story.", label: "3 foto", section: 4 },
    { count: 2, description: "Foto setelah gift sebelum closing.", label: "2 foto", section: 6 },
  ],
  signature: [
    { count: 3, description: "Foto pembuka setelah waktu dan tempat.", label: "3 foto", section: 2 },
    { count: 3, description: "Foto setelah love story bagian 01-03.", label: "3 foto", section: 4 },
    { count: 3, description: "Foto setelah love story bagian 04-06.", label: "3 foto", section: 6 },
    { count: 3, description: "Foto sebelum RSVP dan ucapan.", label: "3 foto", section: 8 },
    { count: 2, description: "Foto setelah RSVP sebelum prakiraan cuaca.", label: "2 foto", section: 10 },
  ],
};

function mediaPlanFor(packageCode: string): MediaSectionPlan[] {
  return mediaSectionPlans[packageCode] ?? mediaSectionPlans.essential!;
}

function gallerySlots(value: string): string[] {
  return value ? value.split("\n") : [];
}

function mediaSectionStart(sections: MediaSectionPlan[], index: number): number {
  return sections.slice(0, index).reduce((total, section) => total + section.count, 0);
}

function parseCoupleNames(value: string): { partnerOne: string; partnerTwo: string } {
  const parts = value
    .split(/\s+(?:dan|and)\s+|\s*&\s*|\s*\+\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    partnerOne: parts[0] ?? "",
    partnerTwo: parts[1] ?? "",
  };
}

function coupleNameWarning(value: string): string {
  const { partnerOne, partnerTwo } = parseCoupleNames(value);
  if (!partnerOne || !partnerTwo) {
    return "Isi nama pasangan dengan format seperti Reno dan Erisa, Reno & Erisa, atau Reno + Erisa.";
  }
  return "";
}

function mediaSectionStatus(
  section: MediaSectionPlan,
  sectionIndex: number,
  sections: MediaSectionPlan[],
  slots: string[],
) {
  const start = mediaSectionStart(sections, sectionIndex);
  const filled = slots.slice(start, start + section.count).filter((url) => url.trim()).length;
  return {
    filled,
    missing: Math.max(section.count - filled, 0),
  };
}

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
  const customChecklist = detail.order.custom_checklist ?? {};

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
    custom_approval_notes: detail.order.custom_approval_notes ?? "",
    custom_brief: detail.order.custom_brief ?? "",
    custom_checklist_assets: Boolean(customChecklist.assets_received),
    custom_checklist_copy: Boolean(customChecklist.copy_approved),
    custom_checklist_final: Boolean(customChecklist.final_approved),
    custom_checklist_motion: Boolean(customChecklist.motion_brief),
    custom_checklist_overlay: Boolean(customChecklist.overlay_assets),
    custom_checklist_parallax: Boolean(customChecklist.parallax_plan),
    custom_status: detail.order.custom_status ?? "none",
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

function linkLifecycleLabel(detail: StaffOrderDetail | null): string {
  if (!detail?.invitation) {
    return "Data belum lengkap";
  }
  if (detail.invitation.status === "published" || detail.order.status === "published") {
    return "Published";
  }
  if (detail.invitation.approval_status === "approved_for_publish" || detail.order.status === "approved") {
    return "Ready to Publish";
  }
  return "Draft Preview";
}

function linkLifecycleDescription(detail: StaffOrderDetail | null): string {
  if (!detail?.invitation) {
    return "Simpan tema dan paket untuk membuat invitation sebelum link dibagikan.";
  }
  if (detail.invitation.status === "published" || detail.order.status === "published") {
    return "Link sudah menjadi link final dan tidak membutuhkan preview token.";
  }
  if (detail.invitation.approval_status === "approved_for_publish" || detail.order.status === "approved") {
    return "Final check sudah siap. Ubah status ke Publikasi untuk membuka link final.";
  }
  return "Link sementara untuk customer dan tamu, masih memakai preview token.";
}

function paymentReminderMessage(detail: StaffOrderDetail | null): string {
  const clientName = detail?.order.client_name || "Customer";
  const outstanding = detail?.payment_summary.outstanding ?? detail?.order.total_amount ?? "0";
  return [
    `Halo ${clientName},`,
    "",
    `Kami informasikan sisa tagihan undangan Niskala saat ini adalah ${formatCurrency(outstanding)}.`,
    "Silakan konfirmasi setelah melakukan transfer agar kami bisa lanjut memproses order.",
  ].join("\n");
}

function communicationStatus(detail: StaffOrderDetail | null, checklist: ChecklistItem[]): string {
  if (!detail?.preview_url) {
    return "Belum ada preview";
  }
  if (detail.order.status === "published" || detail.invitation?.status === "published") {
    return "Publikasi siap dikirim";
  }
  if (checklist.some((item) => !item.done)) {
    return "Data perlu dilengkapi";
  }
  if (detail.revisions.length > 0) {
    return "Menunggu review revisi";
  }
  return "Preview siap dikirim";
}

export function AdminOrderDetail({ reference }: { reference: string }) {
  const [detail, setDetail] = useState<StaffOrderDetail | null>(null);
  const [form, setForm] = useState<OrderDetailForm>(emptyForm);
  const [guestLinks, setGuestLinks] = useState<GuestDeliveryLink[]>([]);
  const [paymentRecordForm, setPaymentRecordForm] = useState<PaymentRecordForm>(
    emptyPaymentRecordForm,
  );
  const [themes, setThemes] = useState<ThemeOption[]>([]);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [revisionNote, setRevisionNote] = useState("");
  const [finalCheck, setFinalCheck] = useState(false);
  const [revisionEdits, setRevisionEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
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
      if (nextDetail.invitation?.public_slug) {
        const links = await staffFetch<GuestDeliveryLink[]>(
          `/admin/invitations/${nextDetail.invitation.public_slug}/guest-links`,
        );
        setGuestLinks(links);
      } else {
        setGuestLinks([]);
      }
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

  function updateGallerySlot(index: number, value: string) {
    const urls = gallerySlots(form.gallery_urls);
    while (urls.length <= index) {
      urls.push("");
    }
    urls[index] = value;
    updateForm("gallery_urls", urls.join("\n"));
  }

  function updatePaymentRecordForm(field: keyof PaymentRecordForm, value: string) {
    setPaymentRecordForm((current) => ({ ...current, [field]: value }));
  }

  async function copyStaffMessage(kind: "data" | "final" | "preview" | "revision") {
    const incompleteItems = completionItems.filter((item) => !item.done).map((item) => item.label);
    const clientName = form.client_name.trim() || "Customer";
    const previewUrl = detail?.preview_url || "";
    const messageMap = {
      data: [
        `Halo ${clientName},`,
        "",
        "Kami sedang menyiapkan undangan Niskala Anda. Agar prosesnya lancar, mohon lengkapi data berikut:",
        ...incompleteItems.map((item) => `- ${item}`),
        "",
        "Silakan kirim data/foto melalui WhatsApp ini ya.",
      ],
      final: [
        `Halo ${clientName},`,
        "",
        "Undangan sudah masuk tahap final/publikasi.",
        previewUrl ? `Link undangan: ${previewUrl}` : "",
        "",
        "Silakan cek kembali sebelum link dibagikan ke tamu.",
      ],
      preview: [
        `Halo ${clientName},`,
        "",
        "Berikut link preview sementara undangan Anda:",
        previewUrl,
        "",
        "Silakan dicek. Jika ada revisi, boleh langsung balas di WhatsApp ini.",
      ],
      revision: [
        `Halo ${clientName},`,
        "",
        "Catatan revisi sudah kami terima dan akan kami proses.",
        previewUrl ? `Link preview saat ini: ${previewUrl}` : "",
      ],
    } satisfies Record<typeof kind, string[]>;
    try {
      await navigator.clipboard.writeText(messageMap[kind].filter(Boolean).join("\n"));
      setNotice("Template pesan WhatsApp disalin.");
    } catch {
      setError("Template pesan WhatsApp gagal disalin.");
    }
  }

  async function saveDetail() {
    const nameWarning = coupleNameWarning(form.client_name);
    if (nameWarning) {
      setError(nameWarning);
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const totalInvited = Number(form.rsvp_invited || 0);
      const totalConfirmed = Number(form.rsvp_confirmed || 0);
      const totalDeclined = Number(form.rsvp_declined || 0);
      const responded = totalConfirmed + totalDeclined;
      const responseRate = totalInvited ? Math.round((responded / totalInvited) * 1000) / 10 : 0;
      const totalAmount = normalizeCurrencyInput(form.total_amount);
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
          custom_approval_notes: form.custom_approval_notes.trim(),
          custom_brief: form.custom_brief.trim(),
          custom_checklist: {
            assets_received: form.custom_checklist_assets,
            copy_approved: form.custom_checklist_copy,
            final_approved: form.custom_checklist_final,
            motion_brief: form.custom_checklist_motion,
            overlay_assets: form.custom_checklist_overlay,
            parallax_plan: form.custom_checklist_parallax,
          },
          custom_status: form.custom_status,
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
          total_amount: totalAmount,
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
      setNotice("Link undangan disalin.");
    } catch {
      setError("Link undangan gagal disalin. Buka link lalu copy dari address bar.");
    }
  }

  async function copyGuestManagementUrl() {
    if (!detail?.guest_management_url) {
      setError("Link form daftar tamu belum tersedia.");
      return;
    }
    try {
      await navigator.clipboard.writeText(detail.guest_management_url);
      setNotice("Link form daftar tamu disalin.");
    } catch {
      setError("Link form daftar tamu gagal disalin.");
    }
  }

  async function copyPaymentReminder() {
    try {
      await navigator.clipboard.writeText(paymentReminderMessage(detail));
      setNotice("Template reminder pembayaran disalin.");
    } catch {
      setError("Template reminder pembayaran gagal disalin.");
    }
  }

  async function createPaymentRecord() {
    if (!paymentRecordForm.amount.trim()) {
      setError("Nominal pembayaran wajib diisi.");
      return;
    }
    setSavingPayment(true);
    setError("");
    setNotice("");
    try {
      const created = await staffFetch<ManualPaymentRecord>(
        `/admin/orders/${reference}/payments`,
        {
          body: JSON.stringify({
            amount: normalizeCurrencyInput(paymentRecordForm.amount),
            method: paymentRecordForm.method,
            note: paymentRecordForm.note.trim(),
            paid_at: paymentRecordForm.paid_at || null,
            payment_type: paymentRecordForm.payment_type,
            proof_url: paymentRecordForm.proof_url.trim(),
            rejection_reason: paymentRecordForm.rejection_reason.trim(),
            review_status: paymentRecordForm.review_status,
          }),
          method: "POST",
        },
      );
      setDetail((current) =>
        current
          ? {
              ...current,
              payments: [created, ...current.payments],
            }
          : current,
      );
      await loadDetail();
      setPaymentRecordForm(emptyPaymentRecordForm);
      setNotice("Pembayaran dicatat.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Pembayaran gagal dicatat.");
    } finally {
      setSavingPayment(false);
    }
  }

  async function updatePaymentReview(
    payment: ManualPaymentRecord,
    reviewStatus: ManualPaymentReviewStatus,
  ) {
    setSavingPayment(true);
    setError("");
    setNotice("");
    try {
      await staffFetch<ManualPaymentRecord>(
        `/admin/orders/${reference}/payments/${payment.id}`,
        {
          body: JSON.stringify({
            review_status: reviewStatus,
            rejection_reason:
              reviewStatus === "rejected"
                ? payment.rejection_reason || "Bukti transfer perlu dicek ulang."
                : payment.rejection_reason,
          }),
          method: "PATCH",
        },
      );
      await loadDetail();
      setNotice("Status bukti pembayaran diperbarui.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Status pembayaran gagal diperbarui.");
    } finally {
      setSavingPayment(false);
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
  const lifecycleLabel = linkLifecycleLabel(detail);
  const lifecycleDescription = linkLifecycleDescription(detail);
  const mediaSections = mediaPlanFor(form.package_code);
  const galleryUrlSlots = gallerySlots(form.gallery_urls);
  const expectedGalleryCount = mediaSections.reduce((total, section) => total + section.count, 0);
  const filledGalleryCount = galleryUrlSlots.filter((url) => url.trim()).length;
  const nameWarning = coupleNameWarning(form.client_name);
  const missingMediaSections = mediaSections
    .map((section, index) => ({
      ...section,
      ...mediaSectionStatus(section, index, mediaSections, galleryUrlSlots),
    }))
    .filter((section) => section.missing > 0);
  const completionItems: ChecklistItem[] = [
    { done: !nameWarning, label: "Nama pasangan" },
    { done: Boolean(form.theme_slug), label: "Tema" },
    { done: Boolean(form.package_code), label: "Paket" },
    { done: Boolean(form.ceremony_starts_at && form.ceremony_venue_name), label: "Data akad" },
    {
      done: Boolean(form.reception_starts_at && form.reception_venue_name),
      label: "Data resepsi",
    },
    { done: Boolean(form.bank_account_bank && form.bank_account_number), label: "Rekening gift" },
    { done: Boolean(form.backsound_url), label: "Musik backsound" },
    { done: filledGalleryCount >= expectedGalleryCount, label: "Foto per section" },
    { done: guestLinks.length > 0, label: "Link tamu" },
  ];
  const communicationLabel = communicationStatus(detail, completionItems);

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
      {!loading && nameWarning ? <Notice tone="warn">{nameWarning}</Notice> : null}
      {!loading && missingMediaSections.length ? (
        <Notice tone="warn">
          Foto belum lengkap untuk{" "}
          {missingMediaSections
            .map((section) => `Section ${section.section} (${section.missing} kosong)`)
            .join(", ")}
          .
        </Notice>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <Panel eyebrow="Status pengerjaan" title={detail?.order.reference ?? reference}>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Status">
                <select
                  className={selectClassName}
                  onChange={(event) => updateForm("status_label", event.target.value)}
                  value={form.status_label}
                >
                  {workflowLabels.map((label) => (
                    <option className={optionClassName} key={label} value={label}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status Pembayaran">
                <select
                  className={selectClassName}
                  onChange={(event) =>
                    updateForm("payment_status", event.target.value as PaymentStatus)
                  }
                  value={form.payment_status}
                >
                  {Object.entries(paymentLabels).map(([value, label]) => (
                    <option className={optionClassName} key={value} value={value}>
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

          <Panel eyebrow="Finance" title="Pembayaran manual.">
            <div className="grid gap-3 md:grid-cols-4">
              <MiniMetric label="Tagihan" value={formatCurrency(form.total_amount || 0)} />
              <MiniMetric
                label="Valid"
                value={formatCurrency(detail?.payment_summary.valid_total ?? 0)}
              />
              <MiniMetric
                label="Menunggu"
                value={formatCurrency(detail?.payment_summary.pending_total ?? 0)}
              />
              <MiniMetric
                label="Sisa"
                value={formatCurrency(detail?.payment_summary.outstanding ?? form.total_amount)}
              />
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <Field label="Jenis">
                <select
                  className={selectClassName}
                  onChange={(event) =>
                    updatePaymentRecordForm(
                      "payment_type",
                      event.target.value as ManualPaymentType,
                    )
                  }
                  value={paymentRecordForm.payment_type}
                >
                  {Object.entries(manualPaymentTypeLabels).map(([value, label]) => (
                    <option className={optionClassName} key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Metode">
                <select
                  className={selectClassName}
                  onChange={(event) =>
                    updatePaymentRecordForm("method", event.target.value as ManualPaymentMethod)
                  }
                  value={paymentRecordForm.method}
                >
                  {Object.entries(manualPaymentMethodLabels).map(([value, label]) => (
                    <option className={optionClassName} key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status Bukti">
                <select
                  className={selectClassName}
                  onChange={(event) =>
                    updatePaymentRecordForm(
                      "review_status",
                      event.target.value as ManualPaymentReviewStatus,
                    )
                  }
                  value={paymentRecordForm.review_status}
                >
                  {Object.entries(manualPaymentReviewLabels).map(([value, label]) => (
                    <option className={optionClassName} key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Nominal">
                <input
                  className={controlClassName}
                  onChange={(event) => updatePaymentRecordForm("amount", event.target.value)}
                  placeholder="99000 atau 99.000"
                  value={paymentRecordForm.amount}
                />
              </Field>
              <Field label="Tanggal Bayar">
                <input
                  className={controlClassName}
                  onChange={(event) => updatePaymentRecordForm("paid_at", event.target.value)}
                  type="datetime-local"
                  value={paymentRecordForm.paid_at}
                />
              </Field>
              <Field label="Bukti Transfer Cloudinary URL">
                <input
                  className={controlClassName}
                  onChange={(event) => updatePaymentRecordForm("proof_url", event.target.value)}
                  placeholder="https://res.cloudinary.com/..."
                  value={paymentRecordForm.proof_url}
                />
              </Field>
              <Field label="Catatan">
                <input
                  className={controlClassName}
                  onChange={(event) => updatePaymentRecordForm("note", event.target.value)}
                  placeholder="DP dari rekening BCA..."
                  value={paymentRecordForm.note}
                />
              </Field>
              <Field label="Alasan ditolak">
                <input
                  className={controlClassName}
                  onChange={(event) =>
                    updatePaymentRecordForm("rejection_reason", event.target.value)
                  }
                  placeholder="Nominal tidak sesuai"
                  value={paymentRecordForm.rejection_reason}
                />
              </Field>
              <div className="flex items-end">
                <button
                  className="inline-flex min-h-11 w-full items-center justify-center gap-3 bg-[var(--color-gold)] px-4 text-xs font-semibold uppercase tracking-[0.14em] text-black transition hover:bg-[#f4ddb0] disabled:opacity-50"
                  disabled={savingPayment}
                  onClick={() => void createPaymentRecord()}
                  type="button"
                >
                  <Plus size={15} />
                  {savingPayment ? "Mencatat" : "Catat Payment"}
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                className={outlineButtonClassName}
                onClick={() => void copyPaymentReminder()}
                type="button"
              >
                <MessageCircle size={15} />
                Copy Reminder WA
              </button>
            </div>

            <div className="mt-5 overflow-x-auto border border-white/10">
              <table className="w-full min-w-[860px] border-collapse text-left text-sm">
                <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.14em] text-white/45">
                  <tr>
                    <th className="px-4 py-3">Jenis</th>
                    <th className="px-4 py-3">Nominal</th>
                    <th className="px-4 py-3">Metode</th>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {detail?.payments.length ? null : (
                    <tr>
                      <td className="px-4 py-6 text-white/45" colSpan={6}>
                        Belum ada pembayaran yang dicatat.
                      </td>
                    </tr>
                  )}
                  {detail?.payments.map((payment) => (
                    <tr className="border-t border-white/10" key={payment.id}>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-white">
                          {manualPaymentTypeLabels[payment.payment_type]}
                        </p>
                        {payment.proof_url ? (
                          <a
                            className="mt-1 block text-xs text-[var(--color-gold)]"
                            href={payment.proof_url}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Buka bukti
                          </a>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-white/70">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="px-4 py-4 text-white/60">
                        {manualPaymentMethodLabels[payment.method]}
                      </td>
                      <td className="px-4 py-4 text-white/60">
                        {payment.paid_at
                          ? new Date(payment.paid_at).toLocaleDateString("id-ID")
                          : "-"}
                      </td>
                      <td className="px-4 py-4 text-white/60">
                        {manualPaymentReviewLabels[payment.review_status]}
                        {payment.review_status === "rejected" && payment.rejection_reason ? (
                          <p className="mt-1 text-xs text-red-200">
                            {payment.rejection_reason}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            className={outlineButtonClassName}
                            disabled={savingPayment}
                            onClick={() => void updatePaymentReview(payment, "valid")}
                            type="button"
                          >
                            Valid
                          </button>
                          <button
                            className={outlineButtonClassName}
                            disabled={savingPayment}
                            onClick={() => void updatePaymentReview(payment, "rejected")}
                            type="button"
                          >
                            Tolak
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel eyebrow="Data Client" title="Informasi customer dan acara.">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Nama">
                <input
                  className={controlClassName}
                  onChange={(event) => updateForm("client_name", event.target.value)}
                  placeholder="Reno dan Erisa"
                  value={form.client_name}
                />
                {nameWarning ? <p className="mt-2 text-xs leading-5 text-[#f4ddb0]">{nameWarning}</p> : null}
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
                  className={selectClassName}
                  onChange={(event) => updateForm("theme_slug", event.target.value)}
                  value={form.theme_slug}
                >
                  <option className={optionClassName} value="">
                    Belum memilih tema
                  </option>
                  {themes.map((theme) => (
                    <option className={optionClassName} key={theme.slug} value={theme.slug}>
                      {theme.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Paket">
                <select
                  className={selectClassName}
                  onChange={(event) => updateForm("package_code", event.target.value)}
                  value={form.package_code}
                >
                  <option className={optionClassName} value="">
                    Belum memilih paket
                  </option>
                  {packages.map((pack) => (
                    <option className={optionClassName} key={pack.code} value={pack.code}>
                      {pack.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Panel>

          <Panel eyebrow="Custom Request" title="Brief dan approval.">
            <div className="grid gap-4 md:grid-cols-[0.7fr_1.3fr]">
              <Field label="Status custom">
                <select
                  className={selectClassName}
                  onChange={(event) =>
                    updateForm("custom_status", event.target.value as CustomStatus)
                  }
                  value={form.custom_status}
                >
                  {Object.entries(customStatusLabels).map(([value, label]) => (
                    <option className={optionClassName} key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Catatan approval">
                <input
                  className={controlClassName}
                  onChange={(event) => updateForm("custom_approval_notes", event.target.value)}
                  placeholder="Scope disetujui, estimasi, batas revisi, atau alasan ditolak."
                  value={form.custom_approval_notes}
                />
              </Field>
            </div>
            <Field label="Brief custom">
              <textarea
                className="min-h-36 w-full border border-white/12 bg-black/20 p-3 text-sm text-white outline-none transition focus:border-[var(--color-gold)]"
                onChange={(event) => updateForm("custom_brief", event.target.value)}
                placeholder="Mood, referensi, love story/timeline, art direction, parallax, overlay motion, deadline, dan batasan request."
                value={form.custom_brief}
              />
            </Field>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <CustomChecklistItem
                checked={form.custom_checklist_assets}
                label="Asset lengkap"
                onChange={(checked) =>
                  setForm((current) => ({ ...current, custom_checklist_assets: checked }))
                }
              />
              <CustomChecklistItem
                checked={form.custom_checklist_motion}
                label="Brief motion jelas"
                onChange={(checked) =>
                  setForm((current) => ({ ...current, custom_checklist_motion: checked }))
                }
              />
              <CustomChecklistItem
                checked={form.custom_checklist_overlay}
                label="Overlay asset siap"
                onChange={(checked) =>
                  setForm((current) => ({ ...current, custom_checklist_overlay: checked }))
                }
              />
              <CustomChecklistItem
                checked={form.custom_checklist_parallax}
                label="Parallax plan aman"
                onChange={(checked) =>
                  setForm((current) => ({ ...current, custom_checklist_parallax: checked }))
                }
              />
              <CustomChecklistItem
                checked={form.custom_checklist_copy}
                label="Copy/story approved"
                onChange={(checked) =>
                  setForm((current) => ({ ...current, custom_checklist_copy: checked }))
                }
              />
              <CustomChecklistItem
                checked={form.custom_checklist_final}
                label="Final approval"
                onChange={(checked) =>
                  setForm((current) => ({ ...current, custom_checklist_final: checked }))
                }
              />
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
              <div className="border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-white/45">
                      Galeri per section
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/55">
                      Paket {form.package_code || "Essential"} membutuhkan {expectedGalleryCount}{" "}
                      foto. Isi berurutan sesuai section agar preview customer dan undangan final
                      tidak tertukar.
                    </p>
                  </div>
                  <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-gold)]">
                    {filledGalleryCount}/{expectedGalleryCount} terisi
                  </p>
                </div>
                <div className="mt-5 grid gap-4">
                  {mediaSections.map((section, sectionIndex) => {
                    const start = mediaSectionStart(mediaSections, sectionIndex);
                    return (
                      <div className="border border-white/10 p-4" key={section.section}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              Section {section.section}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-white/50">
                              {section.description}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "text-xs uppercase tracking-[0.14em]",
                              mediaSectionStatus(
                                section,
                                sectionIndex,
                                mediaSections,
                                galleryUrlSlots,
                              ).missing
                                ? "text-[#f4ddb0]"
                                : "text-emerald-200",
                            )}
                          >
                            {
                              mediaSectionStatus(
                                section,
                                sectionIndex,
                                mediaSections,
                                galleryUrlSlots,
                              ).filled
                            }
                            /{section.count} terisi
                          </span>
                          <span className="text-xs uppercase tracking-[0.14em] text-[var(--color-gold)]">
                            {section.label}
                          </span>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          {Array.from({ length: section.count }).map((_, index) => {
                            const galleryIndex = start + index;
                            return (
                              <label className="block" key={galleryIndex}>
                                <span className="text-[0.62rem] uppercase tracking-[0.14em] text-white/40">
                                  Foto {index + 1}
                                </span>
                                <input
                                  className={`${controlClassName} mt-2`}
                                  onChange={(event) =>
                                    updateGallerySlot(galleryIndex, event.target.value)
                                  }
                                  placeholder="https://res.cloudinary.com/..."
                                  value={galleryUrlSlots[galleryIndex] ?? ""}
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
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

          <Panel eyebrow="Link Tamu & Delivery" title="Form client.">
            <div className="border border-[var(--color-gold)]/35 bg-[var(--color-gold)]/10 p-4">
              <p className="text-sm leading-relaxed text-white/70">
                Bagikan link ini ke client setelah undangan sudah fix dan siap publikasi. Client
                dapat import CSV, export CSV, mencari tamu, copy link personal, dan menandai link
                yang sudah dikirim.
              </p>
              <div className="mt-4 border border-white/10 bg-black/20 p-4">
                <p className="break-all text-sm text-white/80">
                  {detail?.guest_management_url || "Simpan detail order dulu agar link tersedia."}
                </p>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  className={outlineButtonClassName}
                  disabled={!detail?.guest_management_url}
                  onClick={() => void copyGuestManagementUrl()}
                  type="button"
                >
                  <Copy size={15} />
                  Copy Link Form
                </button>
                <a
                  className={cn(
                    outlineButtonClassName,
                    !detail?.guest_management_url && "pointer-events-none opacity-50",
                  )}
                  href={detail?.guest_management_url || "#"}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink size={15} />
                  Buka Form
                </a>
              </div>
            </div>

            <div className="mt-5 grid gap-3 text-sm md:grid-cols-4">
              <div className="border border-white/10 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">Tamu</p>
                <p className="mt-2 text-lg text-white">{detail?.rsvp.total_invited ?? 0}</p>
              </div>
              <div className="border border-white/10 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">Hadir</p>
                <p className="mt-2 text-lg text-white">{detail?.rsvp.total_confirmed ?? 0}</p>
              </div>
              <div className="border border-white/10 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">
                  Tidak Hadir
                </p>
                <p className="mt-2 text-lg text-white">{detail?.rsvp.total_declined ?? 0}</p>
              </div>
              <div className="border border-white/10 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">Response</p>
                <p className="mt-2 text-lg text-[var(--color-gold)]">
                  {detail?.rsvp.response_rate ?? 0}%
                </p>
              </div>
            </div>
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel eyebrow="Komunikasi WA" title="Status customer.">
            <div className="border border-white/12 bg-black/20 p-4">
              <p className="text-[0.58rem] uppercase tracking-[0.16em] text-white/40">
                Status komunikasi
              </p>
              <p className="mt-2 font-serif text-2xl text-white">{communicationLabel}</p>
            </div>
            <div className="mt-4 grid gap-3">
              <button
                className={outlineButtonClassName}
                disabled={!detail?.preview_url}
                onClick={() => void copyStaffMessage("preview")}
                type="button"
              >
                <MessageCircle size={15} />
                Preview Customer
              </button>
              <button
                className={outlineButtonClassName}
                disabled={!completionItems.some((item) => !item.done)}
                onClick={() => void copyStaffMessage("data")}
                type="button"
              >
                <MessageCircle size={15} />
                Minta Data Kurang
              </button>
              <button
                className={outlineButtonClassName}
                onClick={() => void copyStaffMessage("revision")}
                type="button"
              >
                <MessageCircle size={15} />
                Update Revisi
              </button>
              <button
                className={outlineButtonClassName}
                disabled={!detail?.preview_url}
                onClick={() => void copyStaffMessage("final")}
                type="button"
              >
                <MessageCircle size={15} />
                Publikasi Final
              </button>
            </div>
          </Panel>

          <Panel eyebrow="Checklist" title="Kelengkapan.">
            <div className="space-y-3">
              {completionItems.map((item) => (
                <div
                  className="flex items-center justify-between gap-3 border border-white/10 bg-black/20 p-3"
                  key={item.label}
                >
                  <span className="text-sm text-white/70">{item.label}</span>
                  {item.done ? (
                    <CheckCircle2 className="text-emerald-200" size={16} />
                  ) : (
                    <AlertTriangle className="text-[#f4ddb0]" size={16} />
                  )}
                </div>
              ))}
            </div>
          </Panel>

          <Panel eyebrow="Link Undangan" title={lifecycleLabel}>
            <p className="mb-4 text-sm leading-6 text-white/55">{lifecycleDescription}</p>
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

function CustomChecklistItem({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-12 items-center justify-between gap-4 border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
      <span>{label}</span>
      <input
        checked={checked}
        className="h-4 w-4 accent-[var(--color-gold)]"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 bg-black/20 p-4">
      <p className="text-[0.58rem] uppercase tracking-[0.16em] text-white/40">{label}</p>
      <p className="mt-2 font-serif text-xl text-white">{value}</p>
    </div>
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
