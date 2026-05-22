// Recipe — Slither.io
// Opens slither.io and plays automatically.
//
// Strategy:
//   - Main thread: pure movement loop at 50ms ticks — never blocks
//   - Worker thread: runs grounding calls continuously, posts threat state back
//   - On threat: snap into tight panic spin until worker reports all clear
//
// Run: simulang run main.ts
// Requires: OPENROUTER_API_KEY set

import { Worker } from 'node:worker_threads'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import {
  App,
  FocusPolicy,
  Visibility,
  AccessibilityTree,
  AriaRole,
  TraversalOrder,
  MouseController,
  Button,
  KeyboardController,
  Key,
  Direction,
  Coordinate,
  screenshotFull,
  Screen,
  GroundingModel,
  initLogger,
} from '@simular-ai/simulang-js'

// Suppress [info] mouse/key/screenshot noise — only show warnings+
initLogger(null, 'warn')

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const mouse = new MouseController()
const kb    = new KeyboardController()
const model = GroundingModel.default()

// Spam the mute key (F10) rapidly to signal panic — very visible on screen
const spamMute = (times: number) => {
  for (let i = 0; i < times; i++) kb.key(Key.VolumeMute, Direction.Click)
}

// ─── Open slither.io ─────────────────────────────────────────────────────────

console.log('🐍  Opening slither.io…')
const browser = App.defaultBrowser().open('https://slither.io', FocusPolicy.Steal, Visibility.Show, true)
browser.enableAccessibility()
await sleep(4000)

const startTree = AccessibilityTree.fromForeground()
const inputs = startTree.find(TraversalOrder.DepthFirst, AriaRole.Textbox, null, false, 3, true)
if (inputs.length > 0 && inputs[0].refId !== undefined) {
  startTree.setValue(inputs[0].refId, '_')
  await sleep(300)
}

const startShot = screenshotFull(true, Screen.mainScreen())
const [playX, playY] = model.ground(startShot, 'Play button')
mouse.moveMouse(playX, playY, Coordinate.Abs)
mouse.button(Button.Left, Direction.Click)
await sleep(3000)

// ─── Screen geometry ──────────────────────────────────────────────────────────

const [screenX, screenY, screenW, screenH] = Screen.mainScreen().dimensions()

// The snake's head is always pinned to the centre of the game canvas.
// Ground for the snake's eyes to get the exact (cx, cy) — no guesswork needed.
console.log('🎯  Finding snake eyes to calibrate centre…')
const calibShot = screenshotFull(true, Screen.mainScreen())
const [cx, cy] = model.ground(calibShot, 'eyes of the snake')
console.log(`    centre → (${Math.round(cx)}, ${Math.round(cy)})`)

const cropW = 1200, cropH = 800
const cropX = Math.round(cx - cropW / 2)
const cropY = Math.round(cy - cropH / 2)

// ─── Spawn grounding worker ───────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url))
let panicking = false

const worker = new Worker(join(__dirname, 'worker.ts'), {
  workerData: { cropX, cropY, cropW, cropH },
})

let gameOver = false

worker.on('message', ({ threat, gameOver: over }: { threat: boolean; gameOver: boolean }) => {
  if (over) { gameOver = true; console.log('[main] game over — stopping'); return }
  console.log(`[main←worker] threat=${threat} panicking=${panicking}`)

  if (threat && !panicking) { direction = 1; spamMute(5); console.log('[main] PANIC ON') }
  if (!threat && panicking) { nextSwitch = tick + 80; console.log('[main] PANIC OFF') }
  panicking = threat
})

worker.on('error', (err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(`[worker] ⚠️  error (${msg})`)
})

// ─── Movement loop (never blocks) ────────────────────────────────────────────

const TICK_MS = 50

const MODES = [
  { radius: screenW * 0.08, speed: 0.05, minTicks: 25, maxTicks: 50, label: 'wide'  },
  { radius: screenW * 0.03, speed: 0.12, minTicks: 15, maxTicks: 30, label: 'tight' },
]
const PANIC = { radius: screenW * 0.018, speed: 0.18 }

// Sanity check: triple-tap mute to confirm the key works
spamMute(3)

console.log('🎮  Playing… Press Ctrl+C to stop.\n')

let angle      = -Math.PI / 2
let direction  = 1
let modeIdx    = 0
let nextSwitch = MODES[0].minTicks + Math.floor(Math.random() * (MODES[0].maxTicks - MODES[0].minTicks))

// Manual override — hold Shift to take control, release to hand back
const MANUAL_TICKS = 60  // ticks of control after Shift is released (~3s)
let manualUntil = 0

function isShiftHeld(): boolean {
  try {
    // JXA reads NSEvent.modifierFlags directly — 131072 = NSEventModifierFlagShift
    const out = execFileSync('osascript', ['-l', 'JavaScript', '-e',
      'ObjC.import("AppKit"); ($.NSEvent.modifierFlags & 131072) ? "true" : "false"'
    ], { encoding: 'utf8', timeout: 100 }).trim()
    return out === 'true'
  } catch { return false }
}

let tick = 0
while (!gameOver) {
  tick++

  // Check Shift every 5 ticks (~250ms) to avoid blocking the loop too long
  if (tick % 5 === 0 && isShiftHeld()) {
    if (tick > manualUntil) console.log('[main] Shift held — manual control')
    manualUntil = tick + MANUAL_TICKS
  }

  if (tick <= manualUntil) {
    await sleep(TICK_MS)
    continue
  }

  const { radius, speed } = panicking ? PANIC : MODES[modeIdx]
  angle += direction * speed

  mouse.moveMouse(
    cx + Math.cos(angle) * radius,
    cy + Math.sin(angle) * radius,
    Coordinate.Abs,
  )

  // Spam mute every 5 ticks while panicking — continuous indicator
  if (panicking && tick % 5 === 0) spamMute(1)

  if (!panicking && tick >= nextSwitch) {
    modeIdx    = 1 - modeIdx   // always alternate modes
    direction *= -1             // always flip direction
    const m    = MODES[modeIdx]
    nextSwitch = tick + m.minTicks + Math.floor(Math.random() * (m.maxTicks - m.minTicks))
  }

  await sleep(TICK_MS)
}

worker.terminate()
console.log('👋  Game over — mouse released.')
