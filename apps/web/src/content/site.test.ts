import { describe, expect, it } from "vitest";

import { packages } from "./site";

describe("service package benefits", () => {
  it("omits photo counts and revision counts from every package", () => {
    for (const servicePackage of packages) {
      for (const locale of ["id", "en"] as const) {
        expect(
          servicePackage.features[locale].some((feature) =>
            /foto|photo|revisi|revision/i.test(feature),
          ),
        ).toBe(false);
      }
    }
  });

  it("shows weather as the fourth Signature benefit on the homepage", () => {
    const signature = packages.find((servicePackage) => servicePackage.code === "signature");

    expect(signature?.features.id.slice(0, 4)).toEqual([
      "Semua fitur Essential",
      "Love story & timeline",
      "RSVP dan ucapan",
      "Prakiraan cuaca di lokasi acara",
    ]);
    expect(signature?.features.en.slice(0, 4)).toEqual([
      "Everything in Essential",
      "Love story & timeline",
      "RSVP and wishes",
      "Weather forecast at event location",
    ]);
  });
});
