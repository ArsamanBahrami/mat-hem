/**
 * Generates public/icon-192.png and public/icon-512.png.
 * Pure Node.js — no external dependencies.
 * Design: forest-green background + white happy robot (glad robot).
 *   - Rounded square head with two green eyes and a big U-shaped smile
 *   - Antenna stem + ball on top
 *   - Solid background (maskable-safe, no transparent corners)
 * Run from project root: node scripts/generate-icons.mjs
 */

import zlib from 'zlib'
import { writeFileSync } from 'fs'

// ── CRC32 ────────────────────────────────────────────────────────────────────
const CRCT = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRCT[n] = c
}
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRCT[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const l = Buffer.allocUnsafe(4); l.writeUInt32BE(data.length)
  const cv = Buffer.allocUnsafe(4); cv.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([l, t, data, cv])
}

// ── Rounded-rect hit test ────────────────────────────────────────────────────
function inRR(x, y, l, t, r, b, rad) {
  if (x < l || x > r || y < t || y > b) return false
  if (x < l + rad && y < t + rad && (x - l - rad) ** 2 + (y - t - rad) ** 2 > rad * rad) return false
  if (x > r - rad && y < t + rad && (x - r + rad) ** 2 + (y - t - rad) ** 2 > rad * rad) return false
  if (x < l + rad && y > b - rad && (x - l - rad) ** 2 + (y - b + rad) ** 2 > rad * rad) return false
  if (x > r - rad && y > b - rad && (x - r + rad) ** 2 + (y - b + rad) ** 2 > rad * rad) return false
  return true
}

const BG    = [45, 106, 79, 255]   // forest green
const WHITE = [255, 255, 255, 255]

// ── Icon pixel ────────────────────────────────────────────────────────────────
function pixel(x, y, S) {
  const cx = S / 2

  // ── Antenna ball ─────────────────────────────────────────────────────────
  const ballCY = S * 0.085
  const ballR  = S * 0.048
  if ((x - cx) ** 2 + (y - ballCY) ** 2 <= ballR * ballR) return WHITE

  // ── Antenna stem ─────────────────────────────────────────────────────────
  const stemHW = S * 0.014
  const stemT  = ballCY + ballR   // just below ball
  const stemB  = S * 0.215        // just above head top
  if (Math.abs(x - cx) <= stemHW && y >= stemT && y <= stemB) return WHITE

  // ── Robot head ───────────────────────────────────────────────────────────
  const hL = cx - S * 0.245, hR = cx + S * 0.245
  const hT = S * 0.215,      hB = S * 0.765
  const hRad = S * 0.055
  if (!inRR(x, y, hL, hT, hR, hB, hRad)) return BG  // outside head → background

  // ── Eyes (green circles) ─────────────────────────────────────────────────
  const eyeY = hT + (hB - hT) * 0.27
  const eyeR = S * 0.058
  const eyeOX = S * 0.1  // horizontal offset from center
  if ((x - (cx - eyeOX)) ** 2 + (y - eyeY) ** 2 <= eyeR * eyeR) return BG
  if ((x - (cx + eyeOX)) ** 2 + (y - eyeY) ** 2 <= eyeR * eyeR) return BG

  // ── Happy U-shaped smile ──────────────────────────────────────────────────
  // Bottom-half arc of a circle: center above the arc → U opens upward = smile
  const smCY    = hT + (hB - hT) * 0.50  // circle center (top of U)
  const smR     = S * 0.185               // arc radius
  const smThick = S * 0.030               // ring thickness
  if (y >= smCY) {
    const dist = Math.sqrt((x - cx) ** 2 + (y - smCY) ** 2)
    if (dist >= smR - smThick && dist <= smR + smThick) return BG
  }

  return WHITE  // white head interior
}

// ── PNG builder ───────────────────────────────────────────────────────────────
function makePNG(S) {
  const raw = Buffer.allocUnsafe(S * (1 + S * 4))
  for (let y = 0; y < S; y++) {
    const rowOff = y * (1 + S * 4)
    raw[rowOff] = 0
    for (let x = 0; x < S; x++) {
      const [r, g, b, a] = pixel(x, y, S)
      const di = rowOff + 1 + x * 4
      raw[di] = r; raw[di + 1] = g; raw[di + 2] = b; raw[di + 3] = a
    }
  }
  const comp = zlib.deflateSync(raw, { level: 9 })
  const ihdr = Buffer.allocUnsafe(13)
  ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    PNG_SIG,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', comp),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

writeFileSync('public/icon-192.png', makePNG(192))
writeFileSync('public/icon-512.png', makePNG(512))
console.log('Icons generated: public/icon-192.png, public/icon-512.png')
