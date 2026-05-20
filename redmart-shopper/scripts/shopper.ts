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

export interface ShoppingItem {
  id: string
  name: string
  description: string
  qty: number
}

// --- Utilities ---

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function clickAt(x: number, y: number) {
  const mouse = new MouseController()
  mouse.moveMouse(x, y, 0)
  mouse.button(Button.Left, Direction.Click)
}

function getBrowserScreen(): Screen {
  for (const browser of ['Safari', 'Google Chrome']) {
    try {
      const result = execSync(
        `osascript -e 'tell application "${browser}" to get bounds of front window'`,
        { stdio: 'pipe' }
      ).toString().trim()
      const [left, top, right, bottom] = result.split(',').map(s => parseInt(s.trim()))
      if ([left, top, right, bottom].every(n => !isNaN(n))) {
        const mouse = new MouseController()
        mouse.moveMouse(Math.round((left + right) / 2), Math.round((top + bottom) / 2), 0)
        return Screen.fromCurrentMouseLocation()
      }
    } catch {}
  }
  console.warn('  ⚠ could not detect browser screen position — falling back to main screen')
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
      console.warn(`  ⚠ ${label} failed (attempt ${attempt + 1}), retrying...`)
      await sleep(2000)
    }
  }
  throw new Error('unreachable')
}

async function groundAndClick(groundModel: GroundingModel, concept: string) {
  refocusBrowser()
  await sleep(300)
  const { screenshot } = takeScreenshot()
  const [x, y] = await withRetry(`ground("${concept}")`, () => screenshot.ground(groundModel, concept))
  console.log(`  → [vision] "${concept}" at (${x}, ${y})`)
  clickAt(x, y)
}

async function askScreen(askModel: AskModel, prompt: string): Promise<string> {
  refocusBrowser()
  await sleep(300)
  const { image } = takeScreenshot()
  const answer = await withRetry('askModel', () => askModel.ask(prompt, null, [image]))
  console.log(`  → [ask] "${prompt.slice(0, 60)}..." → "${answer.replace(/\n/g, '\\n')}"`)
  return answer
}

function refocusBrowser() {
  App.defaultBrowser().open(null, FocusPolicy.Steal, Visibility.Show, true)
}

async function navigateTo(url: string) {
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
  console.log('→ clearing cart...')
  await navigateTo(config.redmartCartUrl)

  const cartState = await askScreen(
    askModel,
    'Look at this shopping cart. Answer exactly one of: ' +
    '"empty" if there are no items, ' +
    '"selected" if there are items and SELECT ALL is already checked orange, ' +
    '"unselected" if there are items and SELECT ALL is NOT checked.',
  )

  if (cartState.toLowerCase().includes('empty')) {
    console.log('  → cart already empty, skipping clear')
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

  console.log('  ✓ cart cleared')
}

// --- Product selection ---

async function selectProduct(item: ShoppingItem, groundModel: GroundingModel, askModel: AskModel): Promise<number | null> {
  console.log(`  → searching: ${searchUrl(item.name)}`)
  await navigateTo(searchUrl(item.name))

  const response = await askScreen(
    askModel,
    `I want to buy "${item.name}". Specification: "${item.description}". Total quantity needed: ${item.qty}. ` +
    `Look at the search results visible on screen right now and pick the best matching product. ` +
    `IMPORTANT: only select a product you can actually see listed on screen. Do NOT infer or guess from the item name or specification — if the page shows no results, an error, or nothing relevant, you MUST reply with PRODUCT: NONE. ` +
    `When a match is found, reason about quantity combinations: e.g. if spec says "1L" and qty=3, you could pick 3x 1L or 1x 3L — choose whatever best matches the spec. ` +
    `Reply in exactly this format:\nPRODUCT: <exact product name as shown on screen, or NONE>\nQTY: <number of units to add>`,
  )

  const productMatch = response.match(/PRODUCT:\s*(.+)/i)
  const qtyMatch = response.match(/QTY:\s*(\d+)/i)
  const productName = productMatch?.[1]?.trim() ?? ''
  const effectiveQty = qtyMatch ? parseInt(qtyMatch[1], 10) : item.qty

  if (!productName || productName.toUpperCase() === 'NONE') {
    return null
  }

  console.log(`  → [ask] product: "${productName}", qty to add: ${effectiveQty}`)
  await groundAndClick(groundModel, `Add to cart button under "${productName}"`)
  await sleep(config.pageLoadDelayMs)

  return effectiveQty
}

// --- Cart operations ---

async function setQuantity(item: ShoppingItem, groundModel: GroundingModel) {
  if (item.qty === 1) return

  console.log(`  → setting qty to ${item.qty} via stepper`)
  for (let i = 1; i < item.qty; i++) {
    await groundAndClick(groundModel, 'quantity increase button +')
    await sleep(400)
  }
}

// --- Per-item flow ---

async function addItemToCart(item: ShoppingItem, groundModel: GroundingModel, askModel: AskModel) {
  const effectiveQty = await selectProduct(item, groundModel, askModel)
  if (effectiveQty === null) {
    console.log(`  ⚠ skipped ${item.name} — no matching product found`)
    return
  }
  await setQuantity({ ...item, qty: effectiveQty }, groundModel)
  console.log(`  ✓ added ${item.name}`)
}

// --- Entry point ---

export async function shop(shoppingList: ShoppingItem[]): Promise<void> {
  const groundModel = GroundingModel.default()
  const askModel = AskModel.default()

  await clearCart(groundModel, askModel)

  for (const item of shoppingList) {
    console.log(`\n[${item.name}] qty=${item.qty}`)
    await addItemToCart(item, groundModel, askModel)
    await sleep(config.delayBetweenItemsMs)
  }
}
