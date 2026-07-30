export type MediaSectionPlan = {
  count: number;
  description: string;
  label: string;
  photoLabels?: string[];
  section: number;
};

const mediaSectionPlans: Record<string, MediaSectionPlan[]> = {
  couture: [
    {
      count: 2,
      description: "Foto interaktif kedua mempelai setelah waktu dan tempat.",
      label: "2 foto",
      photoLabels: ["Mempelai pria", "Mempelai wanita"],
      section: 2,
    },
    {
      count: 3,
      description: "Foto setelah love story bagian 01-03.",
      label: "3 foto",
      photoLabels: ["Foto atas", "Foto tengah", "Foto bawah"],
      section: 4,
    },
    {
      count: 1,
      description: "Foto latar penuh untuk love story bagian 04-06.",
      label: "1 background",
      photoLabels: ["Background story"],
      section: 5,
    },
    {
      count: 5,
      description:
        "Satu foto penuh dan empat foto kuadran interaktif dengan toggle Couture.",
      label: "5 foto",
      photoLabels: [
        "Foto penuh",
        "Pojok kiri atas",
        "Pojok kanan atas",
        "Pojok kiri bawah",
        "Pojok kanan bawah",
      ],
      section: 6,
    },
    {
      count: 9,
      description: "Galeri kilauan dengan penataan 3 x 3.",
      label: "9 foto",
      section: 8,
    },
    {
      count: 3,
      description: "Tiga background fade untuk love story bagian 07-09.",
      label: "3 background",
      photoLabels: ["Background 1", "Background 2", "Background 3"],
      section: 9,
    },
    {
      count: 10,
      description: "Satu background penuh dan sembilan foto carousel.",
      label: "1 background + 9 foto",
      photoLabels: [
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
      ],
      section: 10,
    },
    {
      count: 3,
      description: "Tiga foto slideshow looping sebelum prakiraan cuaca.",
      label: "3 foto slideshow",
      photoLabels: ["Slideshow 1", "Slideshow 2", "Slideshow 3"],
      section: 12,
    },
  ],
  essential: [
    {
      count: 2,
      description: "Foto interaktif kedua mempelai setelah waktu dan tempat.",
      label: "2 foto",
      photoLabels: ["Mempelai pria", "Mempelai wanita"],
      section: 2,
    },
    {
      count: 3,
      description: "Foto setelah short love story.",
      label: "3 foto",
      section: 4,
    },
    {
      count: 9,
      description: "Galeri 3 x 3 setelah gift sebelum closing.",
      label: "9 foto",
      section: 6,
    },
  ],
  signature: [
    {
      count: 2,
      description: "Foto interaktif kedua mempelai setelah waktu dan tempat.",
      label: "2 foto",
      photoLabels: ["Mempelai pria", "Mempelai wanita"],
      section: 2,
    },
    {
      count: 3,
      description: "Foto setelah love story bagian 01-03.",
      label: "3 foto",
      photoLabels: ["Foto atas", "Foto tengah", "Foto bawah"],
      section: 4,
    },
    {
      count: 5,
      description:
        "Satu foto penuh saat tertutup dan empat foto kuadran interaktif.",
      label: "5 foto",
      photoLabels: [
        "Foto penuh",
        "Pojok kiri atas",
        "Pojok kanan atas",
        "Pojok kiri bawah",
        "Pojok kanan bawah",
      ],
      section: 6,
    },
    {
      count: 9,
      description: "Galeri kilauan dengan penataan 3 x 3.",
      label: "9 foto",
      section: 8,
    },
    {
      count: 9,
      description: "Galeri carousel dengan navigasi kanan dan kiri.",
      label: "9 foto",
      section: 10,
    },
  ],
};

export function mediaPlanFor(packageCode: string): MediaSectionPlan[] {
  return mediaSectionPlans[packageCode] ?? mediaSectionPlans.essential!;
}

export function mediaSectionStart(
  sections: MediaSectionPlan[],
  index: number,
): number {
  return sections
    .slice(0, index)
    .reduce((total, section) => total + section.count, 0);
}

export function mediaSectionStartFor(
  packageCode: string,
  sectionNumber: number,
): number {
  const plan = mediaPlanFor(packageCode);
  const sectionIndex = plan.findIndex(
    (section) => section.section === sectionNumber,
  );
  if (sectionIndex < 0) {
    throw new Error(
      `Section ${sectionNumber} is not part of the ${packageCode} media plan.`,
    );
  }
  return mediaSectionStart(plan, sectionIndex);
}

export function mediaSlotCountFor(packageCode: string): number {
  return mediaPlanFor(packageCode).reduce(
    (total, section) => total + section.count,
    0,
  );
}
