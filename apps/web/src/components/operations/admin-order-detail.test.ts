import { describe, expect, it } from "vitest";

import {
  mediaPlanFor,
  mediaSectionStartFor,
  mediaSlotCountFor,
} from "@/invitations/media-plan";

import { galleryPayloadFor, gallerySlotsFromMedia } from "./admin-order-detail";

describe("staff media plan", () => {
  it.each([
    {
      packageCode: "essential",
      sections: [
        [2, 2, 0],
        [4, 3, 2],
        [6, 9, 5],
      ],
      total: 14,
    },
    {
      packageCode: "signature",
      sections: [
        [2, 2, 0],
        [4, 3, 2],
        [6, 5, 5],
        [8, 9, 10],
        [10, 9, 19],
      ],
      total: 28,
    },
    {
      packageCode: "couture",
      sections: [
        [2, 2, 0],
        [4, 3, 2],
        [5, 1, 5],
        [6, 5, 6],
        [8, 9, 11],
        [9, 3, 20],
        [10, 10, 23],
        [12, 3, 33],
      ],
      total: 36,
    },
  ])("maps every $packageCode media section to stable slots", (entry) => {
    const plan = mediaPlanFor(entry.packageCode);

    expect(
      plan.map(({ count, section }) => [
        section,
        count,
        mediaSectionStartFor(entry.packageCode, section),
      ]),
    ).toEqual(entry.sections);
    expect(mediaSlotCountFor(entry.packageCode)).toBe(entry.total);
  });

  it.each(["essential", "signature", "couture"])(
    "keeps empty %s slots in the outgoing gallery payload",
    (packageCode) => {
      const slots = Array.from(
        { length: mediaSlotCountFor(packageCode) },
        () => "",
      );
      slots[0] = "https://res.cloudinary.com/demo/image/upload/section-2.jpg";
      slots[slots.length - 1] =
        "https://res.cloudinary.com/demo/image/upload/last-section.jpg";

      const payload = galleryPayloadFor(slots.join("\n"), packageCode);

      expect(payload).toHaveLength(mediaSlotCountFor(packageCode));
      expect(payload[0]).toContain("section-2.jpg");
      expect(payload[1]).toBe("");
      expect(payload.at(-1)).toContain("last-section.jpg");
    },
  );

  it("restores sparse media rows to their original form slots", () => {
    const slots = gallerySlotsFromMedia([
      {
        asset: {
          secure_url:
            "https://res.cloudinary.com/demo/image/upload/section-2.jpg",
        },
        role: "gallery",
        sort_order: 0,
      },
      {
        asset: {
          secure_url:
            "https://res.cloudinary.com/demo/image/upload/section-12.jpg",
        },
        role: "gallery",
        sort_order: 33,
      },
    ]).split("\n");

    expect(slots).toHaveLength(34);
    expect(slots[0]).toContain("section-2.jpg");
    expect(slots[1]).toBe("");
    expect(slots[33]).toContain("section-12.jpg");
  });
});
