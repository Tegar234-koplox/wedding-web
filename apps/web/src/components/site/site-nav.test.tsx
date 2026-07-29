import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { SiteNav } from "./site-nav";

afterEach(() => cleanup());

describe("mobile site navigation", () => {
  it("shows the navigation labels without the old sequence numbers", () => {
    render(<SiteNav locale="id" />);

    fireEvent.click(screen.getByRole("button", { name: "Buka menu" }));

    const navigation = screen.getByRole("navigation", {
      name: "Navigasi seluler",
    });

    expect(within(navigation).getByRole("link", { name: "Tema" })).toBeTruthy();
    expect(
      within(navigation).getByRole("link", { name: "Paket" }),
    ).toBeTruthy();
    expect(
      within(navigation).getByRole("link", { name: "Proses" }),
    ).toBeTruthy();
    expect(
      within(navigation).getByRole("link", { name: "Konsultasi" }),
    ).toBeTruthy();

    for (const number of ["01", "02", "03", "04"]) {
      expect(within(navigation).queryByText(number)).toBeNull();
    }
  });
});
