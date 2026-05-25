import { App, FocusPolicy, Visibility, KeyboardController, Key, Direction } from '@simular-ai/simulang-js'
import { click, swipe, sleep, mousePosition } from './controls.ts'
import { capture, findByVision, computeSlots, readBoard } from './vision.ts'
import { bestMove, isGameOver, printBoard } from './strategy.ts'
import type { Board } from './strategy.ts'

const APP_NAME = '2048'
const MAX_MOVES = 300

process.on('SIGINT', () => {
  console.log('\nInterrupted.')
  process.exit(0)
})

async function pollUntil<T>(fn: () => T | null, timeoutMs: number): Promise<T | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const result = fn()
    if (result !== null) return result
    await sleep(50)
  }
  return null
}

// --- Launch & fullscreen ---

const instance = App.exactName(APP_NAME).open(null, FocusPolicy.Steal, Visibility.Show, true)
instance.enableAccessibility()
instance.focus()
await sleep(300)

// Compare the 2048 window directly to the screen *it lives on* — not the main
// screen. A user with two monitors may have the game on a secondary display,
// and `Screen.mainScreen()` would give us the wrong reference.
const [mainWindow] = instance.windows()
if (!mainWindow) throw new Error('2048 window not found')

const winBox = mainWindow.boundingBox()
const screenBox = mainWindow.screen().boundingBox()
const winW = winBox.right - winBox.left
const winH = winBox.bottom - winBox.top
const screenW = screenBox.right - screenBox.left
const screenH = screenBox.bottom - screenBox.top
const isFullscreen = winW >= screenW * 0.98 && winH >= screenH * 0.98

if (!isFullscreen) {
  console.log('Not fullscreen — entering fullscreen...')
  const kb = new KeyboardController()
  kb.key(Key.Control, Direction.Press)
  kb.key(Key.Meta, Direction.Press)
  kb.key(Key.F, Direction.Click)
  kb.key(Key.Meta, Direction.Release)
  kb.key(Key.Control, Direction.Release)
  await sleep(800)
}

// --- New game ---

const menuResult = findByVision(capture(mainWindow), 'menu button')
if (!menuResult) throw new Error('Could not find the Menu button')
click(...menuResult.coords)
await sleep(100)

const newGameResult = findByVision(capture(mainWindow), 'new game button')
if (!newGameResult) throw new Error('Could not find the New Game button')
click(...newGameResult.coords)
await sleep(100)

const rawSlots = await pollUntil(() => computeSlots(instance.pid), 1500)
if (!rawSlots) throw new Error('Game board did not appear in time')
const slots = rawSlots
console.log()

const boardResult = findByVision(capture(mainWindow), 'the 2048 game board')
if (!boardResult) throw new Error('Could not locate the game board center')
const [boardX, boardY] = boardResult.coords
console.log(`Board center: (${boardX}, ${boardY})\n`)

const gridRight = slots.gridLeft + 4 * slots.cellSize
const gridBottom = slots.gridTop + 4 * slots.cellSize

function isMouseInGrid(): boolean {
  const [mx, my] = mousePosition()
  return mx >= slots.gridLeft && mx <= gridRight && my >= slots.gridTop && my <= gridBottom
}

// --- Game loop ---

let running = true

async function waitForMove(prev: Board | null): Promise<void> {
  const prevJson = JSON.stringify(prev)
  const deadline = Date.now() + 600
  while (Date.now() < deadline) {
    await sleep(30)
    if (!isMouseInGrid()) {
      running = false
      return
    }
    const next = readBoard(instance.pid, slots)
    if (next && JSON.stringify(next) !== prevJson) return
  }
}

console.log('Move your cursor outside the board to stop.\n')

let moves = 0
while (running && moves < MAX_MOVES) {
  if (!isMouseInGrid()) {
    console.log('Cursor left the grid — stopping.')
    break
  }

  const board = readBoard(instance.pid, slots)
  if (!board) {
    console.log('No tiles found — stopping.')
    break
  }

  printBoard(board)

  if (isGameOver(board)) {
    console.log('Game over — no valid moves left.')
    break
  }

  const direction = bestMove(board)
  console.log(`Move ${++moves}: ${direction}`)
  swipe(boardX, boardY, direction)
  await waitForMove(board)
}

console.log(`Stopped after ${moves} moves.`)
process.exit(0)
