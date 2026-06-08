// Generates a 1024x1024 placeholder app icon (PNG, RGBA) with no dependencies.
// Output: src-tauri/icons/icon-source.png — feed it to `tauri icon` to produce
// the full macOS icon set. Deterministic; safe to regenerate.
//
// NOTE: placeholder branding — needs a real designed icon + visual QC on Mac.

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SIZE = 1024;
const buf = new Uint8Array(SIZE * SIZE * 4);

function setPx(x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  buf[i] = r;
  buf[i + 1] = g;
  buf[i + 2] = b;
  buf[i + 3] = a;
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

// Diagonal gradient background (Scribely blue).
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const t = (x + y) / (2 * SIZE);
    setPx(x, y, lerp(76, 31, t), lerp(141, 95, t), lerp(255, 224, t));
  }
}

// Rounded white "board" in the centre.
function roundRect(x0, y0, x1, y1, rad, r, g, b) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const dx = Math.max(x0 + rad - x, 0, x - (x1 - 1 - rad));
      const dy = Math.max(y0 + rad - y, 0, y - (y1 - 1 - rad));
      if (dx * dx + dy * dy <= rad * rad) setPx(x, y, r, g, b);
    }
  }
}
roundRect(208, 256, 816, 768, 64, 245, 246, 250);

// A hand-drawn squiggle across the board (thick stroke).
function dot(cx, cy, radius, r, g, b) {
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      if (x * x + y * y <= radius * radius) setPx(cx + x, cy + y, r, g, b);
    }
  }
}
let prev = null;
for (let i = 0; i <= 600; i++) {
  const p = i / 600;
  const x = Math.round(280 + p * 460);
  const y = Math.round(512 + Math.sin(p * Math.PI * 3) * 120);
  if (prev) {
    const steps = Math.max(Math.abs(x - prev[0]), Math.abs(y - prev[1]));
    for (let s = 0; s <= steps; s++) {
      const t = steps === 0 ? 0 : s / steps;
      dot(lerp(prev[0], x, t), lerp(prev[1], y, t), 14, 31, 95, 224);
    }
  }
  prev = [x, y];
}

// ---- Encode PNG (color type 6 = RGBA, 8-bit) ----
function crc32(bytes) {
  let c = ~0;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBytes, Buffer.from(data)]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

// Add a filter byte (0 = none) at the start of each scanline.
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0;
  buf.subarray(y * SIZE * 4, (y + 1) * SIZE * 4).forEach((v, i) => {
    raw[y * (SIZE * 4 + 1) + 1 + i] = v;
  });
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src-tauri", "icons");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "icon-source.png");
writeFileSync(outPath, png);
console.log(`✓ wrote ${outPath} (${png.length} bytes)`);
