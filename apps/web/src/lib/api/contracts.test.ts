import { describe, expect, it } from "vitest";

import { getSampleInvitation } from "@/invitations/samples";

import { publicInvitationSchema } from "./contracts";

function publicInvitation(cover: unknown) {
  return {
    ...getSampleInvitation("elegant-classic", "id"),
    audio: null,
    cover,
    events: [],
    guest: null,
    package_code: "signature",
    public_slug: "alya-raka",
    published_at: "2026-07-17T00:00:00Z",
    theme_slug: "elegant-classic",
  };
}

describe("public invitation cover", () => {
  it("accepts a Cloudinary cover and focal point", () => {
    const result = publicInvitationSchema.safeParse(
      publicInvitation({
        focal_x: 12.5,
        focal_y: 84,
        secure_url: "https://res.cloudinary.com/demo/image/upload/cover.jpg",
      }),
    );

    expect(result.success).toBe(true);
  });

  it("accepts missing or null cover and rejects out-of-range focal points", () => {
    const legacyPayload = publicInvitation(null);
    delete (legacyPayload as { cover?: unknown }).cover;
    const parsedLegacyPayload = publicInvitationSchema.safeParse(legacyPayload);
    expect(parsedLegacyPayload.success).toBe(true);
    if (parsedLegacyPayload.success) {
      expect(parsedLegacyPayload.data.cover).toBeNull();
    }
    expect(publicInvitationSchema.safeParse(publicInvitation(null)).success).toBe(
      true,
    );
    expect(
      publicInvitationSchema.safeParse(
        publicInvitation({
          focal_x: 101,
          focal_y: 50,
          secure_url: "https://res.cloudinary.com/demo/image/upload/cover.jpg",
        }),
      ).success,
    ).toBe(false);
  });
});
