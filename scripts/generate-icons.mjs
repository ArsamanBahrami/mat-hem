// Generates simple placeholder PNG icons using node canvas-like approach
// Run: node scripts/generate-icons.mjs
// (requires `npm install` first to have sharp available, or install separately)

import { createCanvas } from 'canvas'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dir, '..', 'public')

function generateIcon(size) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  // Background
  const r = size * 0.22
  ctx.fillStyle = '#2d6a4f'
  ctx.beginPath()
  ctx.roundRect(0, 0, size, size, r)
  ctx.fill()

  // Emoji
  ctx.font = `${size * 0.55}px serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('🍽️', size / 2, size / 2 + size * 0.04)

  writeFileSync(join(publicDir, `icon-${size}.png`), canvas.toBuffer('image/png'))
  console.log(`Generated icon-${size}.png`)
}

generateIcon(192)
generateIcon(512)
