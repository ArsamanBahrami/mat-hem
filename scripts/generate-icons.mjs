/**
 * Generates public/icon-192.png and public/icon-512.png.
 * Pure Node.js — no external dependencies.
 * Design: forest-green background (#2d6a4f) + white cooking pot (kastrull).
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

// ── Icon pixel (solid bg = maskable-safe) ────────────────────────────────────
function pixel(x, y, S) {
  const cx = S / 2, cy = S / 2

  // Pot body — slightly below center
  const bW = S * 0.38, bH = S * 0.33
  const bL = cx - bW / 2, bR = cx + bW / 2
  const bT = cy - S * 0.055, bB = bT + bH
  if (inRR(x, y, bL, bT, bR, bB, S * 0.055)) return [255, 255, 255, 255]

  // Lid
  const lT = bT - S * 0.055, lB = bT + S * 0.01
  if (inRR(x, y, bL + S * 0.015, lT, bR - S * 0.015, lB, S * 0.015)) return [255, 255, 255, 255]

  // Knob
  if (inRR(x, y, cx - S * 0.042, lT - S * 0.055, cx + S * 0.042, lT, S * 0.016)) return [255, 255, 255, 255]

  // Left handle
  const hT = cy - S * 0.03, hB = cy + S * 0.045
  if (inRR(x, y, bL - S * 0.09, hT, bL + S * 0.006, hB, S * 0.022)) return [255, 255, 255, 255]
  // Right handle
  if (inRR(x, y, bR - S * 0.006, hT, bR + S * 0.09, hB, S * 0.022)) return [255, 255, 255, 255]

  // Forest green background
  return [45, 106, 79, 255]
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
