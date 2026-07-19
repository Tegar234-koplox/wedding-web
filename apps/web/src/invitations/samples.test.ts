import { standardRendererKeys as rendererKeys } from "@wedding/invitation-themes";
import { describe, expect, it } from "vitest";

import { getSampleInvitation } from "./samples";

describe("sample invitation catalog", () => {
  it.each(rendererKeys)("creates a valid bilingual sample for %s", (key) => {
    const idSample = getSampleInvitation(key, "id");
    const enSample = getSampleInvitation(key, "en");

    expect(idSample.rendererKey).toBe(key);
    expect(idSample.rendererVersion).toBe(2);
    expect(enSample.rendererKey).toBe(key);
    expect(idSample.content.gallery).toHaveLength(3);
    expect(enSample.content.event.mapUrl).toMatch(/^https:/);
  });
});
