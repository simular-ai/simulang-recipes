import { MouseController, Button, Coordinate, Direction } from '@simular-ai/simulib-js'

export type SwipeDirection = 'up' | 'down' | 'left' | 'right'

const SWIPE_DISTANCE = 100

const mouse = new MouseController()

export function click(x: number, y: number): void {
  mouse.moveMouse(x, y, Coordinate.Abs)
  mouse.button(Button.Left, Direction.Click)
}

export function swipe(fromX: number, fromY: number, direction: SwipeDirection): void {
  const delta: Record<SwipeDirection, [number, number]> = {
    up:    [0, -SWIPE_DISTANCE],
    down:  [0,  SWIPE_DISTANCE],
    left:  [-SWIPE_DISTANCE, 0],
    right: [ SWIPE_DISTANCE, 0],
  }
  const [dx, dy] = delta[direction]
  mouse.moveMouse(fromX, fromY, Coordinate.Abs)
  mouse.button(Button.Left, Direction.Press)
  mouse.moveMouse(fromX + dx, fromY + dy, Coordinate.Abs)
  mouse.button(Button.Left, Direction.Release)
}

export function mousePosition(): [number, number] {
  return mouse.location()
}

export const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
