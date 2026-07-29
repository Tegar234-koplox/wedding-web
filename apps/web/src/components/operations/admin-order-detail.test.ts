import { describe, expect, it } from "vitest";

import { mediaPlanFor } from "./admin-order-detail";

describe("staff media plan", () => {
  it("maps all 36 Couture slots to their operational section labels", () => {
    const plan = mediaPlanFor("couture");

    expect(plan.map(({ count, section }) => [section, count])).toEqual([
      [2, 2],
      [4, 3],
      [5, 1],
      [6, 5],
      [8, 9],
      [9, 3],
      [10, 10],
      [12, 3],
    ]);
    expect(plan.reduce((total, section) => total + section.count, 0)).toBe(36);
    expect(plan[0]?.photoLabels).toEqual(["Mempelai pria", "Mempelai wanita"]);
    expect(plan[3]?.photoLabels).toEqual([
      "Foto penuh",
      "Pojok kiri atas",
      "Pojok kanan atas",
      "Pojok kiri bawah",
      "Pojok kanan bawah",
    ]);
    expect(plan[6]?.photoLabels).toEqual([
      "Background penuh",
      "Carousel 1",
      "Carousel 2",
      "Carousel 3",
      "Carousel 4",
      "Carousel 5",
      "Carousel 6",
      "Carousel 7",
      "Carousel 8",
      "Carousel 9",
    ]);
  });
});
