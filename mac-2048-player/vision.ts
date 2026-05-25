import {
  GroundingModel,
  screenshotFull,
  AccessibilityTree,
  TraversalOrder,
  type Screenshot,
  type Window,
} from '@simular-ai/simulang-js'
import type { Board } from './strategy.ts'

const model = GroundingModel.default()
const TILE_VALUES = new Set([2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096])

export type Located = { coords: [number, number]; via: 'tree' | 'vision' }

export type GridSlots = { gridLeft: number; gridTop: number; cellSize: number }

// Capture the screen the game window is on — not the main screen. With
// multi-monitor setups the user may have moved the game elsewhere.
export function capture(window: Window): Screenshot {
  return screenshotFull(false, window.screen())
}

export function findByVision(shot: Screenshot, concept: string): Located | null {
  try {
    return { coords: shot.ground(model, concept), via: 'vision' }
  } catch {
    return null
  }
}

// Derive the 4×4 grid bounds from two stable tree landmarks:
//   logo [78] value="2048"       → left edge = grid left
//   subtitle [78] "Join the…"   → right edge = grid right
// The gap (subtitle.top − logo.bottom) repeats below the subtitle → grid top.
// Board is square so cellSize = gridWidth / 4.
//
// Tree is resolved through the instance's PID, so reads work even when the
// game is no longer frontmost (cursor moved to a different window, etc.).
export function computeSlots(pid: number): GridSlots | null {
  try {
    const nodes = AccessibilityTree.fromPid(pid).find(TraversalOrder.BreadthFirst)

    const logo = nodes.find((n) => n.value === '2048' && n.name === '' && n.boundingBox.bottom - n.boundingBox.top > 50)
    const subtitle = nodes.find((n) => (n.value ?? '').startsWith('Join the numbers'))
    if (!logo || !subtitle) return null

    const gap = subtitle.boundingBox.top - logo.boundingBox.bottom
    const gridLeft = logo.boundingBox.left
    const gridTop = subtitle.boundingBox.bottom + gap
    const cellSize = (subtitle.boundingBox.right - gridLeft) / 4

    console.log(`Grid slots  cellSize=${cellSize.toFixed(1)} logical pts`)
    for (let i = 0; i < 4; i++) {
      const ry = (gridTop + (i + 0.5) * cellSize).toFixed(1)
      const cx = (gridLeft + (i + 0.5) * cellSize).toFixed(1)
      console.log(`  row${i} y=${ry}    col${i} x=${cx}`)
    }

    return { gridLeft, gridTop, cellSize }
  } catch {
    return null
  }
}

export function readBoard(pid: number, slots: GridSlots): Board | null {
  try {
    const { gridLeft, gridTop, cellSize } = slots
    const nodes = AccessibilityTree.fromPid(pid).find(TraversalOrder.BreadthFirst)
    const board: Board = Array.from({ length: 4 }, () => Array(4).fill(0))
    let placed = 0

    for (const n of nodes) {
      const value = parseInt(n.value ?? '')
      if (!TILE_VALUES.has(value)) continue
      const col = Math.floor(((n.boundingBox.left + n.boundingBox.right) / 2 - gridLeft) / cellSize)
      const row = Math.floor(((n.boundingBox.top + n.boundingBox.bottom) / 2 - gridTop) / cellSize)
      if (row >= 0 && row < 4 && col >= 0 && col < 4) {
        board[row][col] = value
        placed++
      }
    }

    return placed > 0 ? board : null
  } catch {
    return null
  }
}
