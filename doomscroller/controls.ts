import {
  MouseController,
  KeyboardController,
  Button,
  Coordinate,
  Direction,
  Key,
  type Screen,
} from '@simular-ai/simulang-js'

const mouse = new MouseController()
const kb = new KeyboardController()

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

// Centre of the given screen in global physical pixels. Pass the screen the
// browser window is on (`browser.windows()[0].screen()`) so this works on
// multi-monitor setups where the browser may not be on the primary display.
export function screenCenter(screen: Screen): [number, number] {
  const { left, top, right, bottom } = screen.boundingBox()
  return [Math.round((left + right) / 2), Math.round((top + bottom) / 2)]
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
