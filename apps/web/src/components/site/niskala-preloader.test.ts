import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { getPreloaderCopy } from "./niskala-preloader";

describe("getPreloaderCopy", () => {
  it("provides the requested Indonesian network messages", () => {
    expect(getPreloaderCopy("id", "slow").title).toBe("Koneksi internet lemah...");
    expect(getPreloaderCopy("id", "offline").title).toBe(
      "Tidak ada koneksi internet...",
    );
  });

  it("provides matching English network messages", () => {
    expect(getPreloaderCopy("en", "slow").title).toBe("Weak internet connection...");
    expect(getPreloaderCopy("en", "offline").title).toBe("No internet connection...");
  });

  it("describes action-specific loading and final outcomes", () => {
    expect(getPreloaderCopy("id", "loading", "logout").title).toBe(
      "Mengakhiri sesi...",
    );
    expect(getPreloaderCopy("en", "loading", "login").title).toBe(
      "Signing staff in...",
    );
    expect(getPreloaderCopy("id", "success").title).toBe("Proses berhasil.");
    expect(getPreloaderCopy("en", "error").title).toBe("Process failed.");
  });
});

describe("preloader assets", () => {
  it("renders the offline illustration from the raw precached URL", () => {
    const preloader = readFileSync(
      resolve(process.cwd(), "src/components/site/niskala-preloader.tsx"),
      "utf8",
    );

    expect(preloader).toContain('src="/preloader/no-connection.png"');
    expect(preloader).toMatch(/src="\/preloader\/no-connection\.png"\s+unoptimized/);
  });

  it("keeps the dual balls inside their visual bounds", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/components/site/niskala-preloader.module.css"),
      "utf8",
    );

    expect(css).toMatch(/\.visual\s*\{[^}]*overflow:\s*visible/s);
    expect(css).toMatch(
      /\.dualBall span\s*\{[^}]*left:\s*10%[^}]*width:\s*40%[^}]*height:\s*40%/s,
    );
  });

  it("keeps Indonesian and English offline fallbacks separate", () => {
    const offlineId = readFileSync(
      resolve(process.cwd(), "public/offline-id.html"),
      "utf8",
    );
    const offlineEn = readFileSync(
      resolve(process.cwd(), "public/offline-en.html"),
      "utf8",
    );
    const serviceWorker = readFileSync(
      resolve(process.cwd(), "public/sw.js"),
      "utf8",
    );

    expect(offlineId).toContain("Tidak ada koneksi internet...");
    expect(offlineId).not.toContain("No internet connection...");
    expect(offlineEn).toContain("No internet connection...");
    expect(offlineEn).not.toContain("Tidak ada koneksi internet...");
    expect(serviceWorker).toContain('url.pathname.startsWith("/en/")');
    expect(serviceWorker).toContain('? "/offline-en.html"');
    expect(serviceWorker).toContain(': "/offline-id.html"');
    expect(serviceWorker).toContain('const CACHE_NAME = "niskala-offline-v3"');
    expect(serviceWorker).toContain(
      'url.searchParams.get("url") === OFFLINE_IMAGE',
    );
    expect(serviceWorker).toContain("caches.match(OFFLINE_IMAGE)");
  });
});
