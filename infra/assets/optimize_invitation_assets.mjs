import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const publicRoot = path.join(root, "apps/web/public");
const assets = [
  "images/invitation-essential/section-4/top.png",
  "images/invitation-essential/section-4/middle.png",
  "images/invitation-essential/section-4/bottom.png",
  "images/invitation-essential/section-6/top.png",
  "images/invitation-essential/section-6/bottom.png",
  "images/invitation-signature/section-8/top.png",
  "images/invitation-signature/section-8/middle.png",
  "images/invitation-signature/section-8/bottom.png",
  "images/invitation-signature/section-10/top.png",
  "images/invitation-signature/section-10/bottom.png",
  "images/invitation-couture/photos/section-8/top.png",
  "images/invitation-couture/photos/section-8/middle.png",
  "images/invitation-couture/photos/section-8/bottom.png",
  "images/invitation-couture/photos/section-10/top.png",
  "images/invitation-couture/photos/section-10/middle.png",
  "images/invitation-couture/photos/section-10/bottom.png",
  "images/invitation-couture/photos/section-12/top.png",
  "images/invitation-couture/photos/section-12/middle.png",
  "images/invitation-couture/photos/section-12/bottom.png",
];

for (const relativePath of assets) {
  const source = path.join(publicRoot, relativePath);
  const target = source.replace(/\.png$/i, ".webp");
  await access(source);
  await mkdir(path.dirname(target), { recursive: true });
  await sharp(source).webp({ effort: 6, quality: 82, smartSubsample: true }).toFile(target);
  process.stdout.write(`${relativePath} -> ${path.relative(publicRoot, target)}\n`);
}
