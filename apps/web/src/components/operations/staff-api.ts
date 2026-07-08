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
  notes: string;
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
  preview_url: string;
  wishes_url: string;
  revisions: DetailRevision[];
};

export const staffGateCookie = "niskala_staff_gate";

export const paymentLabels: Record<PaymentStatus, string> = {
  unpaid: "Belum Bayar",
  dp: "DP",
  paid: "Lunas",
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
          ? "Backend staff API sedang error"
          : "Request staff API ditolak";
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
    headers: { Accept: "text/csv" },
  });

  if (!response.ok) {
    throw new StaffFetchError(`Download staff API ditolak (${response.status})`, response.status);
  }

  return response.blob();
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
