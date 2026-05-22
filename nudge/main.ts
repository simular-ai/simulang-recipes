// Recipe — Nudge
// Keeps your presence status active by making a tiny, imperceptible cursor
// movement every 30 seconds. The cursor always returns to exactly where you
// left it. Press Ctrl+C to stop.
//
// Run: simulang run main.ts
// Run for a fixed duration: NUDGE_DURATION_MIN=60 simulang run main.ts

import { MouseController, Coordinate } from '@simular-ai/simulang-js'

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

const INTERVAL_MS   = 3_000  // how often to nudge (ms)
const NUDGE_PX      = 30       // pixels to move and return
const DURATION_MIN  = process.env.NUDGE_DURATION_MIN
  ? parseInt(process.env.NUDGE_DURATION_MIN, 10)
  : null                       // null = run until Ctrl+C

const mouse = new MouseController()
const startTime = Date.now()

console.log('👋  Nudge is running.')
console.log(`    Interval : ${INTERVAL_MS / 1000}s`)
console.log(`    Duration : ${DURATION_MIN ? `${DURATION_MIN} min` : 'until Ctrl+C'}`)
console.log()

let count = 0

while (true) {
  if (DURATION_MIN && Date.now() - startTime >= DURATION_MIN * 60_000) {
    console.log('\n✅  Duration reached. Stopping.')
    break
  }

  await sleep(INTERVAL_MS)

  const [x, y] = mouse.location()
  mouse.moveMouse(x + NUDGE_PX, y, Coordinate.Abs)
  await sleep(300)
  mouse.moveMouse(x, y, Coordinate.Abs)

  count++
  const elapsed = Math.floor((Date.now() - startTime) / 60_000)
  process.stdout.write(`\r  nudge #${count}  ·  ${elapsed} min elapsed`)
}
