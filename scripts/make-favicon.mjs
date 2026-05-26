// Removes red background from logo-source.webp, generates favicon PNGs + ICO
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const src = resolve(root, 'src/assets/logo-source.webp');
const out = resolve(root, 'public');

// --- 1. Load raw pixels and key out the red background ---
const { data, info } = await sharp(src)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;
const px = Buffer.from(data); // mutable copy

for (let i = 0; i < px.length; i += channels) {
  const r = px[i], g = px[i + 1], b = px[i + 2];
  // "redness" = how much red dominates the other channels
  const redness = r - Math.max(g, b);
  if (redness > 90 && r > 180) {
    // strongly red → fully transparent
    px[i + 3] = 0;
  } else if (redness > 30) {
    // anti-aliased edge → fade alpha, also nudge color away from red
    const fade = 1 - (redness - 30) / 60; // 0..1
    px[i + 3] = Math.round(px[i + 3] * fade);
    // remove red spill from kept pixel
    px[i] = Math.min(r, Math.max(g, b));
  }
}

const keyed = sharp(px, { raw: { width, height, channels } })
  .trim({ threshold: 1 }); // crop transparent borders

// --- 2. Master PNG (high-res), then resize for each favicon size ---
const masterBuf = await keyed.clone().png().toBuffer();
const sizes = [16, 32, 48, 180, 512];
const buffers = {};

for (const s of sizes) {
  buffers[s] = await sharp(masterBuf)
    .resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

writeFileSync(resolve(out, 'favicon-16.png'), buffers[16]);
writeFileSync(resolve(out, 'favicon-32.png'), buffers[32]);
writeFileSync(resolve(out, 'favicon-48.png'), buffers[48]);
writeFileSync(resolve(out, 'apple-touch-icon.png'), buffers[180]);
writeFileSync(resolve(out, 'logo-512.png'), buffers[512]);

// --- 3. Build a multi-size ICO (16, 32, 48) from the PNG buffers ---
function buildIco(pngs) {
  // ICONDIR header (6 bytes) + ICONDIRENTRY (16 bytes) per image + PNG data
  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);       // reserved
  header.writeUInt16LE(1, 2);       // type: icon
  header.writeUInt16LE(count, 4);   // image count

  const entries = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  pngs.forEach((p, i) => {
    const e = entries.subarray(i * 16, (i + 1) * 16);
    e.writeUInt8(p.size >= 256 ? 0 : p.size, 0);  // width
    e.writeUInt8(p.size >= 256 ? 0 : p.size, 1);  // height
    e.writeUInt8(0, 2);                            // colors
    e.writeUInt8(0, 3);                            // reserved
    e.writeUInt16LE(1, 4);                         // planes
    e.writeUInt16LE(32, 6);                        // bit count
    e.writeUInt32LE(p.buf.length, 8);              // image size
    e.writeUInt32LE(offset, 12);                   // image offset
    offset += p.buf.length;
  });

  return Buffer.concat([header, entries, ...pngs.map(p => p.buf)]);
}

const ico = buildIco([
  { size: 16, buf: buffers[16] },
  { size: 32, buf: buffers[32] },
  { size: 48, buf: buffers[48] },
]);
writeFileSync(resolve(out, 'favicon.ico'), ico);

console.log('Favicon set generated in public/:');
console.log('  favicon.ico (16/32/48 multi-size)');
console.log('  favicon-16.png, favicon-32.png, favicon-48.png');
console.log('  apple-touch-icon.png (180)');
console.log('  logo-512.png');
