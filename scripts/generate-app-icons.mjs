// Renders the home-screen icons into public/icons/ and the matching favicon.
// Run: node scripts/generate-app-icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const BG = "#c9452c", INK = "#fff7ea";
// The pot mark from the original favicon, drawn on a 64-unit grid centred at (32, 32).
const pot = `<g fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M17 27h30v17a8 8 0 0 1-8 8H25a8 8 0 0 1-8-8Z"/><path d="M14 27h36M12 32h5m30 0h5M27 20h10m-5-5v5m-10-9c-4 5 5 7 1 11m19-11c-4 5 5 7 1 11"/></g>`;
/** scale: how much of the canvas the mark fills; rounded: corner radius for the favicon, 0 for full-bleed icons. */
const icon = (scale, rounded = 0) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="${rounded}" fill="${BG}"/>` +
  `<g transform="translate(32 32) scale(${scale}) translate(-32 -31)">${pot}</g></svg>`;

const out = new URL("../public/icons/", import.meta.url);
mkdirSync(out, { recursive: true });
const png = (svg, size, name) => sharp(Buffer.from(svg), { density: 72 * size / 64 }).resize(size, size).png().toFile(new URL(name, out).pathname);
await Promise.all([
  png(icon(0.84), 192, "icon-192.png"),
  png(icon(0.84), 512, "icon-512.png"),
  // Maskable icons may be cropped to a circle; keep the mark inside the central safe zone.
  png(icon(0.72), 512, "icon-maskable-512.png"),
  png(icon(0.8), 180, "apple-touch-icon.png"),
]);
writeFileSync(new URL("../public/favicon.svg", import.meta.url), icon(1, 16) + "\n");
console.log("Wrote app icons to public/icons/.");
