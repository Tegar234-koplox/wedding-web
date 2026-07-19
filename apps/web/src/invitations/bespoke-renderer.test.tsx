import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { defaultBespokeConfig } from "@wedding/invitation-themes";
import React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { BespokeRenderer } from "./bespoke-renderer";
import { getSampleInvitation } from "./samples";

beforeAll(() => {
  Object.defineProperty(HTMLMediaElement.prototype, "pause", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
});

afterEach(() => cleanup());

describe("BespokeRenderer", () => {
  it("renders the shared section configuration, guest personalization, and audio control", async () => {
    const sample = getSampleInvitation("elegant-classic", "id");
    const bespoke = {
      ...defaultBespokeConfig,
      sections: [
        defaultBespokeConfig.sections[0]!,
        defaultBespokeConfig.sections[1]!,
        {
          id: "timeline",
          type: "timeline" as const,
          variant: "timeline.vertical@1" as const,
          enabled: true,
        },
        {
          id: "gift",
          type: "gift" as const,
          variant: "gift.cards@1" as const,
          enabled: true,
        },
        defaultBespokeConfig.sections.at(-1)!,
      ],
    };

    render(
      <BespokeRenderer
        audio={{
          default_volume: 0.5,
          loop: true,
          secure_url: "https://res.cloudinary.com/demo/video/upload/song.mp3",
          title: "Our song",
        }}
        invitation={{
          content: {
            ...sample.content,
            bank_accounts: [
              { account_number: "123456789", bank: "BCA", name: "Alya" },
            ],
            bespoke,
          },
          guest: { displayName: "Bapak Budi dan Keluarga" },
          locale: "id",
        }}
      />,
    );

    expect(
      screen.getByText(/Kepada Yth. Bapak Budi dan Keluarga/),
    ).toBeTruthy();
    expect(screen.getAllByText("Buka peta")).toHaveLength(2);
    expect(screen.getByText("Bab perjalanan kami")).toBeTruthy();
    expect(screen.getByText("Hadiah pernikahan")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Putar musik" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Jeda musik" })).toBeTruthy(),
    );
  });
});
