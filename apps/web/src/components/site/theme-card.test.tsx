import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { themes } from "@/content/site";

import { ThemeCard } from "./theme-card";

afterEach(() => cleanup());

describe("theme card", () => {
  it("shows a centered view cue without the old number and arrow affordances", () => {
    render(<ThemeCard locale="id" theme={themes[0]!} />);

    expect(screen.getByText("Lihat").className).toContain("left-1/2");
    expect(screen.queryByText("01")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Lihat tema Elegant Classic" }),
    ).toBeTruthy();
  });
});
