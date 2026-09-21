import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { rendererRegistry } from "./renderer-registry";
import { getSampleInvitation } from "./samples";

beforeAll(() => vi.stubGlobal("React", React));
afterAll(() => vi.unstubAllGlobals());
afterEach(cleanup);

describe("legacy invitation weather fallback", () => {
  it("shows a dedicated message after the celebration has passed", () => {
    const LegacyRenderer = rendererRegistry["islamic-soft"][1];
    if (!LegacyRenderer) {
      throw new Error("Legacy renderer version 1 is not registered.");
    }

    render(
      <LegacyRenderer
        invitation={getSampleInvitation("islamic-soft", "id", "signature")}
        packageCode="signature"
        weather={{
          attribution_url: "https://open-meteo.com/",
          forecast: [],
          provider: "Open-Meteo",
          reason: "event_passed",
          status: "unavailable",
        }}
      />,
    );

    expect(screen.getByText("Hari Perayaan telah usai")).toBeTruthy();
    expect(
      screen.getByText(
        "Terima kasih telah menjadi bagian dari hari perayaan kami.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Tersedia mendekati hari acara")).toBeNull();
  });
});
