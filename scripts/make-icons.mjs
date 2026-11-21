// Erzeugt die App-Icons (PNG) ohne zusätzliche Bibliotheken.
// Motiv: dunkles Quadrat mit rotem Kreis. Aufruf: npm run icons
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const BG = [0x1e, 0x29, 0x3b];
const RED = [0xc8, 0x32, 0x3c];

// CRC32 für PNG-Blöcke
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** size: Kantenlänge, cornerRatio: Eckenradius (0 = eckig), circleRatio: Kreisradius */
function makeIcon(size, cornerRatio, circleRatio) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const cr = size * cornerRatio;
  const r = size * circleRatio;
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // Filtertyp „none“
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      // Abgerundete Ecken: Abstand zur nächsten Eckenmitte
      let alpha = 1;
      if (cr > 0) {
        const dx = Math.max(cr - px, px - (size - cr), 0);
        const dy = Math.max(cr - py, py - (size - cr), 0);
        alpha = Math.min(1, Math.max(0, cr - Math.hypot(dx, dy) + 0.5));
      }
      // Kreis mit weicher Kante
      const d = Math.hypot(px - c, py - c);
      const t = Math.min(1, Math.max(0, r - d + 0.5));
      const col = BG.map((b, i) => Math.round(b * (1 - t) + RED[i] * t));
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = col[0];
      raw[o + 1] = col[1];
      raw[o + 2] = col[2];
      raw[o + 3] = Math.round(alpha * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // Bit-Tiefe
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public', { recursive: true });
writeFileSync('public/icon-192.png', makeIcon(192, 0.2, 0.27));
writeFileSync('public/icon-512.png', makeIcon(512, 0.2, 0.27));
writeFileSync('public/icon-maskable-512.png', makeIcon(512, 0, 0.22));
writeFileSync('public/apple-touch-icon.png', makeIcon(180, 0, 0.25));
console.log('Icons erzeugt in public/');
