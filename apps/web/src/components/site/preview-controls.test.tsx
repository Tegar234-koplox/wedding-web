import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/id/preview/dark-cinematic",
  useRouter: () => ({ replace: navigation.replace }),
}));

import { PreviewFrame } from "./preview-frame";
import { PreviewPackageSelector } from "./preview-package-selector";

afterEach(() => {
  cleanup();
  navigation.replace.mockClear();
});

describe("preview controls", () => {
  it("keeps the interactive preview section hidden below the desktop breakpoint", () => {
    const { container } = render(
      <PreviewFrame locale="id" slug="dark-cinematic" title="Dark Cinematic" />,
    );
    const section = container.querySelector("section");

    expect(section?.className).toContain("hidden");
    expect(section?.className).toContain("md:block");
  });

  it("lets visitors hide and restore the live preview package controls", () => {
    render(
      <PreviewPackageSelector
        locale="id"
        selected="signature"
        theme="Dark Cinematic"
      />,
    );

    const hide = screen.getByRole("button", {
      name: "Sembunyikan kontrol live preview",
    });
    expect(hide.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "essential" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /WhatsApp/i })).toBeNull();

    fireEvent.click(hide);

    const show = screen.getByRole("button", {
      name: "Tampilkan kontrol live preview",
    });
    expect(show.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById("preview-package-controls")?.className).toBe(
      "hidden",
    );

    fireEvent.click(show);

    expect(document.getElementById("preview-package-controls")?.className).toBe(
      "contents",
    );
    expect(screen.getByRole("button", { name: "essential" })).toBeTruthy();
  });

  it("keeps package selection navigation unchanged", () => {
    render(
      <PreviewPackageSelector
        locale="id"
        selected="signature"
        theme="Dark Cinematic"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "couture" }));

    expect(navigation.replace).toHaveBeenCalledWith(
      "/id/preview/dark-cinematic?package=couture",
      { scroll: false },
    );
  });
});
