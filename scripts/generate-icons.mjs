// Regenerates public/icons/*.png. Run: node scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

// Flashcard lettermark on the manifest's theme color (#0f172a).
// `pad` shrinks the artwork toward the center — maskable icons need the
// content inside the ~80% safe zone.
function iconSvg(size, pad = 0) {
  const s = size;
  const g = (n) => (n * (s - 2 * pad)) / 512 + pad; // scale 512-based coords
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
  <rect width="${s}" height="${s}" rx="${pad > 0 ? 0 : s * 0.22}" fill="#0f172a"/>
  <rect x="${g(150)}" y="${g(120)}" width="${g(260) - pad}" height="${g(300) - pad}"
        rx="${g(28) - pad}" fill="#334155" transform="rotate(8 ${s / 2} ${s / 2})"/>
  <rect x="${g(110)}" y="${g(110)}" width="${g(260) - pad}" height="${g(300) - pad}"
        rx="${g(28) - pad}" fill="#f8fafc" transform="rotate(-4 ${s / 2} ${s / 2})"/>
  <text x="${s * 0.46}" y="${s * 0.55}" font-family="Georgia, serif" font-weight="bold"
        font-size="${(s - 2 * pad) * 0.34}" fill="#0f172a" text-anchor="middle"
        dominant-baseline="central" transform="rotate(-4 ${s / 2} ${s / 2})">V</text>
</svg>`;
}

await mkdir(new URL("../public/icons/", import.meta.url), { recursive: true });

const targets = [
  { file: "icon-192.png", size: 192, pad: 0 },
  { file: "icon-512.png", size: 512, pad: 0 },
  { file: "icon-maskable-512.png", size: 512, pad: 60 },
];

for (const { file, size, pad } of targets) {
  const out = new URL(`../public/icons/${file}`, import.meta.url).pathname;
  await sharp(Buffer.from(iconSvg(size, pad))).png().toFile(out);
  console.log(`wrote ${file}`);
}
