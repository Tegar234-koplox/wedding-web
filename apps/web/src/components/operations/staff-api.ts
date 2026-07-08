"use client";

import { env } from "@/lib/env";

export type StaffSessionUser = {
  username: string;
  email: string;
  role: string;
  display_name: string;
};

export type StaffSession = {
  user: StaffSessionUser;
};

export type PaymentStatus = "unpaid" | "dp" | "paid";
export type CustomStatus =
  | "none"
  | "requested"
  | "scoping"
  | "approved"
  | "in_progress"
  | "ready"
  | "rejected";
export type ManualPaymentType = "dp" | "settlement" | "other";
export type ManualPaymentMethod = "bank_transfer" | "qris" | "cash" | "other";
export type ManualPaymentReviewStatus = "pending" | "valid" | "rejected";

export type Order = {
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
  payment_valid_total?: string;
  payment_pending_total?: string;
  payment_outstanding?: string;
  notes: string;
  custom_status: CustomStatus;
  custom_brief: string;
  custom_approval_notes: string;
  custom_checklist: Record<string, boolean>;
  created_at: string;
  updated_at: string;
};

export type ThemeOption = {
  slug: string;
  name: string;
  category: string;
};

export type ThemePage = {
  results: ThemeOption[];
};

export type PackageOption = {
  code: string;
  name: string;
  price: string;
  currency: string;
};

export type DetailEvent = {
  id: string;
  event_type: "ceremony" | "reception" | "other";
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  venue_name: string;
  address: string;
  map_url: string;
};

export type DetailMedia = {
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

export type DetailRevision = {
  id: string;
  revision_number: number;
  label: string;
  note: string;
  is_final_check: boolean;
  created_at: string;
  created_by_email: string | null;
};

export type GuestDeliveryLink = {
  id: string;
  display_name: string;
  email: string;
  phone: string;
  party_size: number;
  rsvp_status: "pending" | "accepted" | "declined" | string;
  attendance_count: number;
  responded_at: string | null;
  delivery_url: string | null;
  token_available: boolean;
  created_at: string;
};

export type GuestImportRow = {
  row_number: number;
  name: string;
  phone: string;
  email: string;
  party_size: number;
  group: string;
  note: string;
  status: "ready" | "error" | string;
  action: "create" | "update" | "skip" | string;
  errors: string[];
  warnings: string[];
  matched_guest_id: string | null;
  delivery_url: string | null;
};

export type GuestImportResult = {
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

export type ManualPaymentRecord = {
  id: string;
  payment_type: ManualPaymentType;
  payment_type_label: string;
  method: ManualPaymentMethod;
  method_label: string;
  review_status: ManualPaymentReviewStatus;
  review_status_label: string;
  amount: string;
  currency: string;
  proof_url: string;
  paid_at: string | null;
  note: string;
  rejection_reason: string;
  recorded_by_email: string | null;
  reviewed_by_email: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ManualPaymentSummary = {
  valid_total: string;
  pending_total: string;
  rejected_total: string;
  outstanding: string;
  payment_status: PaymentStatus;
};

export type StaffOrderDetail = {
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
    rsvp_manual: Record<string, number | string>;
  };
  events: DetailEvent[];
  media: DetailMedia[];
  rsvp: {
    total_invited: number;
    total_confirmed: number;
    total_declined: number;
    response_rate: number;
  };
  payments: ManualPaymentRecord[];
  payment_summary: ManualPaymentSummary;
  preview_url: string;
  revisions: DetailRevision[];
};

export const staffGateCookie = "niskala_staff_gate";

export const paymentLabels: Record<PaymentStatus, string> = {
  unpaid: "Belum Bayar",
  dp: "DP",
  paid: "Lunas",
};

export const customStatusLabels: Record<CustomStatus, string> = {
  approved: "Disetujui",
  in_progress: "Dikerjakan",
  none: "Tidak Ada",
  ready: "Siap Review",
  rejected: "Ditolak",
  requested: "Diminta",
  scoping: "Briefing",
};

export const manualPaymentTypeLabels: Record<ManualPaymentType, string> = {
  dp: "DP",
  settlement: "Pelunasan",
  other: "Lainnya",
};

export const manualPaymentMethodLabels: Record<ManualPaymentMethod, string> = {
  bank_transfer: "Transfer Bank",
  qris: "QRIS",
  cash: "Cash",
  other: "Lainnya",
};

export const manualPaymentReviewLabels: Record<ManualPaymentReviewStatus, string> = {
  pending: "Belum dicek",
  valid: "Valid",
  rejected: "Ditolak",
};

export const workflowLabels = [
  "Baru",
  "Data Kurang",
  "Proses",
  "Revisi",
  "Final",
  "Publikasi",
];

export const statusWorkflow: Record<string, string> = {
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

export const workflowStatusDefaults: Record<string, string> = {
  Baru: "lead",
  "Data Kurang": "confirmed",
  Proses: "in_design",
  Revisi: "revision",
  Final: "approved",
  Publikasi: "published",
};

export class StaffFetchError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "StaffFetchError";
  }
}

export function staffGateCookieAttributes(maxAge: number) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  return `Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

export function clearStaffGateCookie() {
  document.cookie = `${staffGateCookie}=; ${staffGateCookieAttributes(0)}`;
}

export function redirectToStaffLogin() {
  clearStaffGateCookie();
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

export async function staffFetch<T>(path: string, init?: RequestInit): Promise<T> {
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
          ? "Server operasional sedang bermasalah"
          : "Request dashboard ditolak";
    throw new StaffFetchError(
      `${label} (${response.status})${detail ? `: ${detail}` : ""}`,
      response.status,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export async function staffDownload(path: string): Promise<Blob> {
  const response = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
    credentials: "include",
    headers: { Accept: "*/*" },
  });

  if (!response.ok) {
    throw new StaffFetchError(`Download CSV gagal (${response.status})`, response.status);
  }

  return response.blob();
}

export async function staffUpload<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
    body: formData,
    credentials: "include",
    headers: {
      Accept: "application/json",
      "X-CSRFToken": await csrfToken(),
    },
    method: "POST",
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
    throw new StaffFetchError(
      `Upload CSV gagal (${response.status})${detail ? `: ${detail}` : ""}`,
      response.status,
    );
  }

  return response.json() as Promise<T>;
}

export function workflowFor(order: Pick<Order, "status" | "workflow_label">): string {
  return order.workflow_label ?? statusWorkflow[order.status] ?? order.status;
}

export function formatCurrency(value: string | number): string {
  return new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(Number(value || 0));
}

export function normalizeCurrencyInput(value: string): string {
  const cleaned = value.trim().replace(/[^\d,.-]/g, "");
  if (!cleaned) {
    return "0.00";
  }

  let normalized = cleaned;
  if (cleaned.includes(",")) {
    const [integerPart, ...decimalParts] = cleaned.split(",");
    const integer = (integerPart ?? "").replace(/[^\d-]/g, "");
    const decimals = decimalParts.join("").replace(/\D/g, "").slice(0, 2);
    normalized = decimals ? `${integer}.${decimals}` : integer;
  } else if (cleaned.includes(".")) {
    const parts = cleaned.split(".");
    const last = parts.at(-1) ?? "";
    normalized =
      parts.length > 1 && last.length > 0 && last.length <= 2
        ? `${parts.slice(0, -1).join("").replace(/[^\d-]/g, "")}.${last}`
        : cleaned.replace(/[^\d-]/g, "");
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Harga harus berupa angka rupiah yang valid.");
  }
  return amount.toFixed(2);
}

export function formatDate(value?: string | null): string {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value));
}
