import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminLogin } from "./admin-login";

const routerMocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

vi.mock("@/components/site/niskala-preloader", async () => {
  const { createElement } = await import("react");
  return {
    NetworkAwarePreloader: ({ description }: { description?: string }) =>
      createElement("div", null, description),
    NiskalaPreloader: ({ description }: { description?: string }) =>
      createElement("div", null, description),
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  routerMocks.refresh.mockReset();
  routerMocks.replace.mockReset();
  document.cookie = "niskala_staff_gate=; Max-Age=0; Path=/";
  localStorage.clear();
  sessionStorage.clear();
});

function submitCredentials() {
  fireEvent.change(screen.getByLabelText(/Username atau email/i), {
    target: { value: "owner@niskala.test" },
  });
  fireEvent.change(screen.getByLabelText(/^Password$/i), {
    target: { value: "correct-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: /^Masuk$/i }));
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

describe("AdminLogin", () => {
  it("enrolls MFA on first login and reveals recovery codes only after confirmation", async () => {
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");
    const requestBodies = new Map<string, Record<string, string>>();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/auth/csrf")) {
        return jsonResponse({ csrfToken: "csrf-token" });
      }
      requestBodies.set(
        url,
        JSON.parse(String(init?.body)) as Record<string, string>,
      );
      if (url.endsWith("/auth/login")) {
        return jsonResponse({
          challenge: "first-login-challenge",
          enrollment_required: true,
          mfa_required: true,
        });
      }
      if (url.endsWith("/auth/login/mfa/enroll")) {
        return jsonResponse({
          otpauth_uri:
            "otpauth://totp/Niskala:owner?secret=FIRSTLOGINSECRET&issuer=Niskala",
          qr_data_url: "data:image/png;base64,iVBORw0KGgo=",
        });
      }
      if (url.endsWith("/auth/login/mfa/confirm")) {
        return jsonResponse({
          recovery_codes: ["RECOVERY-ONE", "RECOVERY-TWO"],
          user: {
            display_name: "Owner",
            email: "owner@niskala.test",
            mfa_enrolled: true,
            role: "staff",
            staff_role: "owner",
            username: "owner",
          },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<AdminLogin />);
    submitCredentials();

    expect(
      await screen.findByRole("heading", { name: "Aktifkan MFA." }),
    ).toBeTruthy();
    expect(screen.getByAltText("QR aktivasi authenticator")).toBeTruthy();
    expect(screen.getByText(/FIRSTLOGINSECRET/)).toBeTruthy();
    expect(requestBodies.get("/api/staff/auth/login/mfa/enroll")).toEqual({
      challenge: "first-login-challenge",
    });
    expect(screen.queryByLabelText(/^Password$/i)).toBeNull();

    fireEvent.change(screen.getByLabelText(/^Kode authenticator$/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Aktifkan MFA$/i }));

    expect(
      await screen.findByRole("heading", { name: "Simpan recovery code." }),
    ).toBeTruthy();
    expect(screen.getByLabelText("Recovery codes").textContent).toContain(
      "RECOVERY-ONE",
    );
    expect(screen.queryByText(/FIRSTLOGINSECRET/)).toBeNull();
    expect(requestBodies.get("/api/staff/auth/login/mfa/confirm")).toEqual({
      challenge: "first-login-challenge",
      code: "123456",
    });
    expect(storageSpy).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: /Sudah disimpan, lanjut/i }),
    );
    await waitFor(() => {
      expect(routerMocks.replace).toHaveBeenCalledWith("/admin");
      expect(screen.queryByText("RECOVERY-ONE")).toBeNull();
    });
    expect(routerMocks.refresh).toHaveBeenCalledOnce();
    expect(document.cookie).toContain("niskala_staff_gate=1");
  });

  it("keeps the existing MFA login path for enrolled staff", async () => {
    const calls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/auth/csrf")) {
        return jsonResponse({ csrfToken: "csrf-token" });
      }
      if (url.endsWith("/auth/login")) {
        return jsonResponse({
          challenge: "mfa-challenge",
          enrollment_required: false,
          mfa_required: true,
        });
      }
      if (url.endsWith("/auth/login/mfa")) {
        return jsonResponse({
          user: {
            display_name: "Owner",
            email: "owner@niskala.test",
            mfa_enrolled: true,
            role: "staff",
            staff_role: "owner",
            username: "owner",
          },
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<AdminLogin />);
    submitCredentials();

    expect(
      await screen.findByLabelText(/Kode authenticator atau recovery/i),
    ).toBeTruthy();
    expect(screen.queryByAltText("QR aktivasi authenticator")).toBeNull();
    fireEvent.change(
      screen.getByLabelText(/Kode authenticator atau recovery/i),
      { target: { value: "654321" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /^Verifikasi$/i }));

    await waitFor(() =>
      expect(routerMocks.replace).toHaveBeenCalledWith("/admin"),
    );
    expect(calls).toContain("/api/staff/auth/login/mfa");
    expect(calls).not.toContain("/api/staff/auth/login/mfa/enroll");
  });

  it("does not expose backend authentication details", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/auth/csrf")) {
        return jsonResponse({ csrfToken: "csrf-token" });
      }
      return jsonResponse(
        { detail: "Account exists but password hash comparison failed." },
        401,
      );
    });

    render(<AdminLogin />);
    submitCredentials();

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Login tidak berhasil. Periksa kembali data akun Anda.",
    );
    expect(screen.queryByText(/password hash comparison failed/i)).toBeNull();
  });

  it("fails closed when a successful login response is malformed", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      return url.endsWith("/auth/csrf")
        ? jsonResponse({ csrfToken: "csrf-token" })
        : jsonResponse({});
    });

    render(<AdminLogin />);
    submitCredentials();

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Respons login staff tidak valid.",
    );
    expect(routerMocks.replace).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain("niskala_staff_gate=1");
  });
});
