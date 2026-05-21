import { MouseController, KeyboardController, Button, Coordinate, Direction, Key, Screen } from '@simular-ai/simulib-js'

const mouse = new MouseController()
const kb    = new KeyboardController()

export function click(x: number, y: number): void {
  mouse.moveMouse(x, y, Coordinate.Abs)
  mouse.button(Button.Left, Direction.Click)
}

export function moveTo(x: number, y: number): void {
  mouse.moveMouse(x, y, Coordinate.Abs)
}

export function scrollDown(amount = 5): void {
  mouse.scroll(0, amount)
}

export function typeText(text: string): void {
  kb.text(text)
}

export function pressEnter(): void {
  kb.key(Key.Return, Direction.Click)
}

export function screenCenter(): [number, number] {
  const [sx, sy, sw, sh] = Screen.mainScreen().dimensions()
  return [Math.round(sx + sw / 2), Math.round(sy + sh / 2)]
}

export const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
