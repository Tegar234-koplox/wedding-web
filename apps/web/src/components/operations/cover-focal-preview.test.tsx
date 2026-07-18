import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CoverFocalPreview, normalizeFocalPoint } from "./cover-focal-preview";

afterEach(() => cleanup());

describe("cover focal preview", () => {
  it("switches between mobile, tablet, and desktop aspect ratios", () => {
    render(
      <CoverFocalPreview
        focalX={48}
        focalY={52}
        onFocalChange={vi.fn()}
        photoUrl="https://res.cloudinary.com/demo/image/upload/cover.jpg"
      />,
    );

    const surface = screen.getByTestId("cover-focal-surface");
    expect(surface.getAttribute("data-preview-mode")).toBe("mobile");
    expect(surface.className).toContain("aspect-[9/16]");
    expect(surface.getAttribute("style")).toContain("48% 52%");

    fireEvent.click(screen.getByRole("button", { name: /Tablet 3:4/i }));
    expect(surface.getAttribute("data-preview-mode")).toBe("tablet");
    expect(surface.className).toContain("aspect-[3/4]");

    fireEvent.click(screen.getByRole("button", { name: /Desktop 16:9/i }));
    expect(surface.getAttribute("data-preview-mode")).toBe("desktop");
    expect(surface.className).toContain("aspect-[16/9]");
  });

  it("updates both axes from pointer and keyboard input", () => {
    const onFocalChange = vi.fn();
    render(
      <CoverFocalPreview
        focalX={48}
        focalY={52}
        onFocalChange={onFocalChange}
        photoUrl="https://res.cloudinary.com/demo/image/upload/cover.jpg"
      />,
    );

    const surface = screen.getByTestId("cover-focal-surface");
    vi.spyOn(surface, "getBoundingClientRect").mockReturnValue({
      bottom: 420,
      height: 400,
      left: 10,
      right: 210,
      top: 20,
      width: 200,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    });

    fireEvent.click(surface, { clientX: 60, clientY: 120, detail: 1 });
    expect(onFocalChange).toHaveBeenCalledWith(25, 25);

    fireEvent.keyDown(surface, { key: "ArrowRight", shiftKey: true });
    expect(onFocalChange).toHaveBeenCalledWith(53, 52);

    fireEvent.keyDown(surface, { key: "ArrowUp" });
    expect(onFocalChange).toHaveBeenCalledWith(48, 51);
  });

  it("resets the focus and disables the surface without a photo", () => {
    const onFocalChange = vi.fn();
    render(
      <CoverFocalPreview
        focalX={12}
        focalY={88}
        onFocalChange={onFocalChange}
        photoUrl=""
      />,
    );

    expect(
      (screen.getByTestId("cover-focal-surface") as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Reset 50/50" }));
    expect(onFocalChange).toHaveBeenCalledWith(50, 50);
  });

  it("clamps focal values to the supported range", () => {
    expect(normalizeFocalPoint(-1)).toBe(0);
    expect(normalizeFocalPoint(101)).toBe(100);
    expect(normalizeFocalPoint(Number.NaN)).toBe(50);
  });
});
