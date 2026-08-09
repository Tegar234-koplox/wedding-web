import { describe, expect, it } from "vitest";

import {
  mediaPlanFor,
  mediaSectionStartFor,
  mediaSlotCountFor,
} from "@/invitations/media-plan";

import {
  galleryPayloadFor,
  gallerySlotsFromMedia,
  isPublicationReady,
  orderPatchPayloadForRole,
} from "./admin-order-detail";

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

describe("staff order PATCH RBAC", () => {
  const unrestrictedPayload = {
    ceremony: { venue_name: "Venue" },
    client_email: "client@example.test",
    client_name: "Reno & Erisa",
    client_phone: "+628123456789",
    currency: "IDR",
    event_date: "2026-12-12",
    media_urls: { photo: "https://res.cloudinary.com/demo/photo.jpg" },
    notes: "Hubungi via WhatsApp",
    payment_status: "paid",
    status: "in_design",
    theme_slug: "floral-romantic",
    total_amount: "249000.00",
  };

  it("never submits derived payment_status, including for owner", () => {
    const payload = orderPatchPayloadForRole("owner", unrestrictedPayload);

    expect(payload).not.toHaveProperty("payment_status");
    expect(payload).toMatchObject({
      client_email: "client@example.test",
      status: "in_design",
      total_amount: "249000.00",
    });
  });

  it("submits publication as a status-only owner request", () => {
    expect(
      orderPatchPayloadForRole("owner", {
        ...unrestrictedPayload,
        status: "published",
      }),
    ).toEqual({ status: "published" });
  });

  it("limits editor payload to content fields and safe workflow targets", () => {
    expect(orderPatchPayloadForRole("editor", unrestrictedPayload)).toEqual({
      ceremony: { venue_name: "Venue" },
      client_name: "Reno & Erisa",
      event_date: "2026-12-12",
      media_urls: {
        photo: "https://res.cloudinary.com/demo/photo.jpg",
      },
      notes: "Hubungi via WhatsApp",
      status: "in_design",
      theme_slug: "floral-romantic",
    });
    expect(
      orderPatchPayloadForRole("editor", {
        ...unrestrictedPayload,
        status: "published",
      }),
    ).not.toHaveProperty("status");
  });

  it("limits support payload to client contact fields", () => {
    expect(orderPatchPayloadForRole("support", unrestrictedPayload)).toEqual({
      client_email: "client@example.test",
      client_name: "Reno & Erisa",
      client_phone: "+628123456789",
      event_date: "2026-12-12",
      notes: "Hubungi via WhatsApp",
    });
  });

  it("keeps finance generic fields minimal and viewer read-only", () => {
    expect(orderPatchPayloadForRole("finance", unrestrictedPayload)).toEqual({
      currency: "IDR",
      total_amount: "249000.00",
    });
    expect(orderPatchPayloadForRole("viewer", unrestrictedPayload)).toEqual({});
  });
});

describe("staff publication approval guard", () => {
  it("requires persisted Final status and invitation approval", () => {
    expect(isPublicationReady("client_review", "client_review")).toBe(false);
    expect(isPublicationReady("approved", "client_review")).toBe(false);
    expect(isPublicationReady("client_review", "approved_for_publish")).toBe(
      false,
    );
    expect(isPublicationReady("approved", "approved_for_publish")).toBe(true);
    expect(isPublicationReady("published", "published")).toBe(true);
  });
});
