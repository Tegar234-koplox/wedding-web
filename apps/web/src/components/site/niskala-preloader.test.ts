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
