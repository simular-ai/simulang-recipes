import {
  App,
  FocusPolicy,
  Visibility,
  AskModel,
  GroundingModel,
  Image,
  KeyboardController,
  Key,
  Direction,
  MouseController,
  Button,
  screenshotFull,
  Screen,
} from '@simular-ai/simulang-js'
import { execSync } from 'child_process'
import { config } from './config.ts'
import { log } from './logger.ts'

export interface ShoppingItem {
  id: string
  name: string
  description: string
  qty: number
}

export class UserEscapeError extends Error {
  constructor() {
    super('run cancelled — cursor moved to screen corner')
  }
}

// --- Utilities ---

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const CORNER_PX = 50

function checkEscape(): void {
  const [mx, my] = new MouseController().location()
  const [sx, sy, sw, sh] = Screen.mainScreen().dimensions()
  const nearH = mx < sx + CORNER_PX || mx > sx + sw - CORNER_PX
  const nearV = my < sy + CORNER_PX || my > sy + sh - CORNER_PX
  if (nearH && nearV) throw new UserEscapeError()
}

function clickAt(x: number, y: number) {
  const mouse = new MouseController()
  mouse.moveMouse(x, y, 0)
  mouse.button(Button.Left, Direction.Click)
}

function getBrowserScreen(): Screen {
  for (const browser of ['Safari', 'Google Chrome']) {
    try {
      const result = execSync(`osascript -e 'tell application "${browser}" to get bounds of front window'`, {
        stdio: 'pipe',
      })
        .toString()
        .trim()
      const [left, top, right, bottom] = result.split(',').map((s) => parseInt(s.trim()))
      if ([left, top, right, bottom].every((n) => !isNaN(n))) {
        const mouse = new MouseController()
        mouse.moveMouse(Math.round((left + right) / 2), Math.round((top + bottom) / 2), 0)
        return Screen.fromCurrentMouseLocation()
      }
    } catch {}
  }
  log.warn('⚠ could not detect browser screen position — falling back to main screen')
  return Screen.mainScreen()
}

function takeScreenshot(): { screenshot: ReturnType<typeof screenshotFull>; image: Image } {
  const screenshot = screenshotFull(true, getBrowserScreen())
  const image = Image.fromBase64(screenshot.base64())
  return { screenshot, image }
}

async function withRetry<T>(label: string, fn: () => T, retries = 2): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return fn()
    } catch (err) {
      if (attempt === retries) throw err
      log.warn(`⚠ ${label} failed (attempt ${attempt + 1}), retrying...`)
      await sleep(2000)
    }
  }
  throw new Error('unreachable')
}

async function groundAndClick(groundModel: GroundingModel, concept: string) {
  checkEscape()
  refocusBrowser()
  await sleep(300)
  const { screenshot } = takeScreenshot()
  const [x, y] = await withRetry(`ground("${concept}")`, () => screenshot.ground(groundModel, concept))
  log.debug(`[vision] "${concept}" → (${x}, ${y})`)
  clickAt(x, y)
}

async function askScreen(askModel: AskModel, prompt: string): Promise<string> {
  checkEscape()
  refocusBrowser()
  await sleep(300)
  const { image } = takeScreenshot()
  const answer = await withRetry('askModel', () => askModel.ask(prompt, null, [image]))
  log.debug(`[ask] "${prompt.slice(0, 60)}..." → "${answer.replace(/\n/g, '\\n')}"`)
  return answer
}

function refocusBrowser() {
  App.defaultBrowser().open(null, FocusPolicy.Steal, Visibility.Show, true)
}

async function navigateTo(url: string) {
  log.debug(`[nav] ${url}`)
  refocusBrowser()
  await sleep(300)
  const kb = new KeyboardController()
  kb.key(Key.Meta, Direction.Press)
  kb.key(Key.L, Direction.Click)
  kb.key(Key.Meta, Direction.Release)
  await sleep(200)
  kb.text(url)
  kb.key(Key.Return, Direction.Click)
  await sleep(config.pageLoadDelayMs)
}

function searchUrl(query: string): string {
  return `${config.redmartBaseUrl}/catalog/?q=${encodeURIComponent(query)}&m=redmart`
}

// --- Cart clearing ---

export async function clearCart(groundModel: GroundingModel, askModel: AskModel) {
  log.info('→ clearing cart...')
  await navigateTo(config.redmartCartUrl)

  const cartState = await askScreen(
    askModel,
    'Look at this Redmart shopping cart page carefully. ' +
      'Find the SELECT ALL checkbox near the top left of the item list. ' +
      'Answer exactly one word — nothing else: ' +
      '"empty" if there are no items in the cart at all, ' +
      '"selected" if the SELECT ALL checkbox is filled/ticked with an orange checkmark, ' +
      '"unselected" if the SELECT ALL checkbox is empty, hollow, grey, or unchecked in any way. ' +
      'When in doubt, answer "empty".',
  )

  if (cartState.toLowerCase().includes('empty')) {
    log.debug('cart already empty')
    return
  }

  if (cartState.toLowerCase().includes('unselected')) {
    await groundAndClick(groundModel, 'SELECT ALL checkbox')
    await sleep(600)
  }

  await groundAndClick(groundModel, 'DELETE text link or button')
  await sleep(600)

  await groundAndClick(groundModel, 'REMOVE button in blue')
  await sleep(600)

  log.ok('  ✓ cart cleared')
}

// --- Product selection ---

function productSelectionPrompt(item: ShoppingItem): string {
  return (
    `I want to buy "${item.name}". Specification: "${item.description}". Weekly target: ${item.qty}. ` +
    `Look at the search results on screen and pick the best matching product. ` +
    `Only select a product you can actually see on screen — if there are no results or nothing relevant, reply PRODUCT: NONE. ` +
    `Choose like a practical shopper: prefer products that match the specification, but sensible substitutions are fine. The weekly target is a guide — rounding to a nearby pack size is fine, but do not buy bulk quantities that far exceed it. If the smallest available pack already delivers more than twice the weekly target, prefer a different product or reply PRODUCT: NONE. ` +
    `For QTY: figure out how many units delivers roughly the weekly target for one week. Do this in two steps — first convert volumes if sizes differ, then divide by pack size. ` +
    `Example: target 6× 320ml cans; only a 24-pack available → that is 4 weeks of supply, way too much → look for a smaller pack or reply PRODUCT: NONE. ` +
    `Example: target 6× 320ml cans; 6-pack available → QTY: 1. ` +
    `Reply in exactly this format:\nPRODUCT: <exact product name as shown on screen, or NONE>\nQTY: <number of units to add>`
  )
}

function parseProductResponse(response: string, fallbackQty: number): { productName: string; qty: number } | null {
  const productName = response.match(/PRODUCT:\s*(.+)/i)?.[1]?.trim() ?? ''
  const qty = response.match(/QTY:\s*(\d+)/i)?.[1] ? parseInt(response.match(/QTY:\s*(\d+)/i)![1], 10) : fallbackQty
  if (!productName || productName.toUpperCase() === 'NONE') return null
  return { productName, qty }
}

async function selectProduct(
  item: ShoppingItem,
  groundModel: GroundingModel,
  askModel: AskModel,
): Promise<{ productName: string; qty: number } | null> {
  await navigateTo(searchUrl(item.name))
  const response = await askScreen(askModel, productSelectionPrompt(item))
  const result = parseProductResponse(response, item.qty)
  if (!result) return null
  log.debug(`[ask] picked "${result.productName}" ×${result.qty}`)
  await groundAndClick(groundModel, `Add to cart button under "${result.productName}"`)
  await sleep(config.pageLoadDelayMs)
  return result
}

// --- Cart operations ---

async function setQuantity(item: ShoppingItem, groundModel: GroundingModel) {
  if (item.qty === 1) return

  log.debug(`[qty] incrementing to ${item.qty}`)
  for (let i = 1; i < item.qty; i++) {
    await groundAndClick(groundModel, 'quantity increase button +')
    await sleep(400)
  }
}

// --- Per-item flow ---

async function addItemToCart(item: ShoppingItem, groundModel: GroundingModel, askModel: AskModel): Promise<boolean> {
  const result = await selectProduct(item, groundModel, askModel)
  if (!result) {
    log.warn(`  ⚠ skipped — not found on Redmart`)
    return false
  }
  await setQuantity({ ...item, qty: result.qty }, groundModel)
  log.ok(`  ✓ added ${result.qty}× ${result.productName}`)
  return true
}

// --- Entry point ---

export async function shop(shoppingList: ShoppingItem[]): Promise<void> {
  const groundModel = GroundingModel.default()
  const askModel = AskModel.default()

  await clearCart(groundModel, askModel)

  let added = 0
  for (let i = 0; i < shoppingList.length; i++) {
    const item = shoppingList[i]
    log.info(`\n[${i + 1}/${shoppingList.length}] ${item.name}`)
    if (await addItemToCart(item, groundModel, askModel)) added++
    await sleep(config.delayBetweenItemsMs)
  }

  const skipped = shoppingList.length - added
  log.rule()
  if (skipped === 0) {
    log.ok(`✓ all ${added} items added to cart`)
  } else {
    log.ok(`✓ ${added} added`)
    log.warn(`⚠ ${skipped} skipped — not found on Redmart`)
  }
}
