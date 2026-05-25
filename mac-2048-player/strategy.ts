export type Board = number[][]
export type SwipeDirection = 'up' | 'down' | 'left' | 'right'

const DIRECTIONS: SwipeDirection[] = ['up', 'down', 'left', 'right']

const EMPTY_WEIGHT = 270
const MERGES_WEIGHT = 700
const MONOTONICITY_WEIGHT = 47
const SUM_WEIGHT = 11
const DEPTH_LIMIT = 3

function slideRow(row: number[]): number[] {
  const tiles = row.filter((v) => v !== 0)
  const merged: number[] = []
  let i = 0
  while (i < tiles.length) {
    if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
      merged.push(tiles[i] * 2)
      i += 2
    } else {
      merged.push(tiles[i++])
    }
  }
  while (merged.length < 4) merged.push(0)
  return merged
}

function transpose(board: Board): Board {
  return board[0].map((_, c) => board.map((row) => row[c]))
}

function simulateMove(board: Board, dir: SwipeDirection): Board {
  if (dir === 'left') return board.map((row) => slideRow(row))
  if (dir === 'right') return board.map((row) => slideRow([...row].reverse()).reverse())
  if (dir === 'up') return transpose(transpose(board).map((col) => slideRow(col)))
  /* down */ return transpose(transpose(board).map((col) => slideRow([...col].reverse()).reverse()))
}

function boardsEqual(a: Board, b: Board): boolean {
  return a.every((row, r) => row.every((v, c) => v === b[r][c]))
}

function emptyCells(board: Board): [number, number][] {
  const cells: [number, number][] = []
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (board[r][c] === 0) cells.push([r, c])
  return cells
}

function scoreBoard(board: Board): number {
  let score = 0
  for (let i = 0; i < 4; i++) {
    const row = board[i]
    const col = board.map((r) => r[i])
    for (const line of [row, col]) {
      score += EMPTY_WEIGHT * line.filter((v) => v === 0).length
      let merges = 0
      for (let j = 0; j < 3; j++) if (line[j] !== 0 && line[j] === line[j + 1]) merges++
      score += MERGES_WEIGHT * merges
      let ascending = 0,
        descending = 0
      for (let j = 0; j < 3; j++) {
        if (line[j] > line[j + 1]) descending += line[j] - line[j + 1]
        else ascending += line[j + 1] - line[j]
      }
      score -= MONOTONICITY_WEIGHT * Math.min(ascending, descending)
      score -= SUM_WEIGHT * line.reduce((a, b) => a + b, 0)
    }
  }
  return score
}

function expectimax(board: Board, depth: number): number {
  if (depth >= DEPTH_LIMIT) return scoreBoard(board)
  const empty = emptyCells(board)
  if (empty.length === 0) return scoreBoard(board)
  let total = 0
  for (const [r, c] of empty) {
    for (const [value, prob] of [
      [2, 0.9],
      [4, 0.1],
    ] as [number, number][]) {
      const next: Board = board.map((row) => [...row])
      next[r][c] = value
      total += prob * maxMove(next, depth)
    }
  }
  return total
}

function maxMove(board: Board, depth: number): number {
  let best = 0
  for (const dir of DIRECTIONS) {
    const next = simulateMove(board, dir)
    if (!boardsEqual(next, board)) best = Math.max(best, expectimax(next, depth + 1))
  }
  return best
}

export function isGameOver(board: Board): boolean {
  return DIRECTIONS.every((dir) => boardsEqual(simulateMove(board, dir), board))
}

export function printBoard(board: Board): void {
  const cell = (v: number) => (v === 0 ? '     .' : String(v).padStart(6))
  const divider = '+-------+-------+-------+-------+'
  console.log(divider)
  for (const row of board) {
    console.log('|' + row.map(cell).join(' |') + ' |')
    console.log(divider)
  }
}

export function bestMove(board: Board): SwipeDirection {
  let best: SwipeDirection = 'right'
  let bestScore = -Infinity
  for (const dir of DIRECTIONS) {
    const next = simulateMove(board, dir)
    if (!boardsEqual(next, board)) {
      const score = expectimax(next, 0)
      if (score > bestScore) {
        bestScore = score
        best = dir
      }
    }
  }
  return best
}
