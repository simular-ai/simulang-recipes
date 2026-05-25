// Worker thread — pixel-based threat detection via connected components.
// No API calls. Takes a screenshot, thresholds by lightness, finds connected
// components of bright pixels. 2+ large components = enemy snake present.

import { workerData, parentPort } from 'node:worker_threads'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Jimp } from 'jimp'
import { screenshotCropped, screenshotFull, Screen, AskModel } from '@simular-ai/simulang-js'

const { cropX, cropY, cropW, cropH } = workerData as {
  cropX: number
  cropY: number
  cropW: number
  cropH: number
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEBUG = process.env.SLITHER_DEBUG === '1'
const DEBUG_PATH = join(__dirname, 'debug_binary.png')

// ─── Tuning ───────────────────────────────────────────────────────────────────
const BRIGHTNESS_THRESH = 80 // pixels brighter than this = foreground (0-255)
const MIN_COMPONENT_SIZE = 800 // ignore small blobs — snake bodies are large, food/glow are tiny
const THREAT_THRESHOLD = 2 // ≥ this many large components = enemy nearby
const DEBUG_EVERY = 20 // save debug image every N iterations

// ─── Connected components with 5px radius connectivity ────────────────────────
// Instead of 4-connected neighbors, each foreground pixel connects to any other
// foreground pixel within a 5px radius. This bridges small gaps in the snake
// body when it curves near the crop boundary, preventing our own snake from
// being split into 2 components.
const CONNECT_R = 8
const CONNECT_R2 = CONNECT_R * CONNECT_R

function countComponents(binary: Uint8Array, w: number, h: number): number {
  const visited = new Uint8Array(w * h)
  let count = 0

  for (let i = 0; i < binary.length; i++) {
    if (binary[i] === 0 || visited[i]) continue

    const queue: number[] = [i]
    visited[i] = 1
    let size = 0

    while (queue.length > 0) {
      const idx = queue.pop()!
      size++
      const x = idx % w,
        y = (idx - x) / w

      const x0 = Math.max(0, x - CONNECT_R),
        x1 = Math.min(w - 1, x + CONNECT_R)
      const y0 = Math.max(0, y - CONNECT_R),
        y1 = Math.min(h - 1, y + CONNECT_R)
      for (let ny = y0; ny <= y1; ny++) {
        for (let nx = x0; nx <= x1; nx++) {
          const dx = nx - x,
            dy = ny - y
          if (dx * dx + dy * dy > CONNECT_R2) continue
          const ni = ny * w + nx
          if (binary[ni] && !visited[ni]) {
            visited[ni] = 1
            queue.push(ni)
          }
        }
      }
    }

    if (size >= MIN_COMPONENT_SIZE) count++
  }
  return count
}

// ─── Main loop ────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const start = Date.now()
const ts = () => `+${((Date.now() - start) / 1000).toFixed(2)}s`

let iteration = 0

while (true) {
  iteration++
  const t0 = Date.now()

  // Decode directly from base64 — no tmp file, no disk I/O
  const shot = screenshotCropped(cropX, cropY, cropW, cropH, true)
  const b64 = shot.base64().replace(/^data:image\/\w+;base64,/, '')
  const img = await Jimp.read(Buffer.from(b64, 'base64'))
  const w = img.width
  const h = img.height
  const data = img.bitmap.data // RGBA flat array, 4 bytes per pixel
  const binary = new Uint8Array(w * h)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const offset = (y * w + x) * 4
      const r = data[offset]
      const g = data[offset + 1]
      const b = data[offset + 2]
      binary[y * w + x] = (r + g + b) / 3 > BRIGHTNESS_THRESH ? 1 : 0
    }
  }

  // Count large connected components
  const numComponents = countComponents(binary, w, h)
  const threat = numComponents >= THREAT_THRESHOLD

  console.log(`[worker ${ts()}] components=${numComponents} (${Date.now() - t0}ms) → threat=${threat}`)
  parentPort!.postMessage({ threat, gameOver: false })

  // Save debug image periodically (set SLITHER_DEBUG=1 to enable)
  if (DEBUG && iteration % DEBUG_EVERY === 0) {
    const debug = new Jimp({ width: w, height: h, color: 0x000000ff })
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = binary[y * w + x] ? 255 : 0
        const offset = (y * w + x) * 4
        debug.bitmap.data[offset] = v
        debug.bitmap.data[offset + 1] = v
        debug.bitmap.data[offset + 2] = v
        debug.bitmap.data[offset + 3] = 255
      }
    }
    await debug.write(DEBUG_PATH as `${string}.png`)
    console.log(`[worker ${ts()}] debug image saved → ${DEBUG_PATH}`)
  }

  // ── Game-over detection (every 30 iterations) ────────────────────────────
  if (iteration % 30 === 0) {
    const fullShot = screenshotFull(true, Screen.mainScreen())
    fullShot.shrink(960, 540)
    fullShot.compress(40)
    const answer = AskModel.default().ask(
      'Is the game over? Does the screen show a death screen or "Play Again" button? Reply only "yes" or "no".',
      null,
      [fullShot],
    )
    if (/yes/i.test(answer)) {
      console.log('[worker] game over detected')
      parentPort!.postMessage({ threat: false, gameOver: true })
    }
  }

  await sleep(20)
}
