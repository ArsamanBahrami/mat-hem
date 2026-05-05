// Generates minimal solid-color PNG icons without external deps
import { deflateSync } from 'zlib'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dir, '..', 'public')

function createPNG(width, height, r, g, b) {
  function crc32(buf) {
    let c = 0xFFFFFFFF
    const table = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
      let v = i
      for (let j = 0; j < 8; j++) v = v & 1 ? 0xEDB88320 ^ (v >>> 1) : v >>> 1
      table[i] = v
    }
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
    return (c ^ 0xFFFFFFFF) >>> 0
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const typeBytes = Buffer.from(type, 'ascii')
    const combined = Buffer.concat([typeBytes, data])
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(combined))
    return Buffer.concat([len, typeBytes, data, crc])
  }

  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 2   // color type: RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  // Raw pixel data with filter bytes
  const rowSize = 1 + width * 3
  const raw = Buffer.alloc(height * rowSize)
  for (let y = 0; y < height; y++) {
    raw[y * rowSize] = 0 // filter type none
    for (let x = 0; x < width; x++) {
      const off = y * rowSize + 1 + x * 3
      raw[off] = r; raw[off + 1] = g; raw[off + 2] = b
    }
  }

  const idat = deflateSync(raw)

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

// Forest green: #2d6a4f = rgb(45, 106, 79)
const png192 = createPNG(192, 192, 45, 106, 79)
const png512 = createPNG(512, 512, 45, 106, 79)

writeFileSync(join(publicDir, 'icon-192.png'), png192)
writeFileSync(join(publicDir, 'icon-512.png'), png512)
console.log('Generated icon-192.png and icon-512.png')
