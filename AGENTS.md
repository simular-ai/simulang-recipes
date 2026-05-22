# AGENTS.md — simulang-recipes

Context for AI assistants (Cursor, Claude, Copilot, etc.) working in this repo.

## What this repo is

A collection of TypeScript desktop-automation scripts that run with the
`simulang` CLI against `@simular-ai/simulang-js`. Each recipe is a
self-contained folder with `main.ts`, `package.json`, `tsconfig.json`, and a
`README.md`. macOS only.

## Package

Always import from `@simular-ai/simulang-js` — never `simulib-js` (old name,
retired). Current version: `^6.0.1`.

```ts
import {
  App, FocusPolicy, Visibility,
  AccessibilityTree, TraversalOrder,
  GroundingModel, AskModel,
  MouseController, KeyboardController,
  Clipboard, Screen, screenshotFull,
  initLogger,
} from '@simular-ai/simulang-js'
```

Named imports only. No default import, no `as any`, no `@ts-ignore`.

## Script structure

Every `main.ts` follows this shape:

```ts
// Recipe — <Name>
// One-line description.
//
// Run: simulang run main.ts
// Requires: OPENROUTER_API_KEY set   ← only if vision/LLM used

import { ... } from '@simular-ai/simulang-js'

initLogger(null, 'warn')   // suppress [info] noise; omit for simple scripts

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

process.on('SIGINT', () => { console.log('\nInterrupted.'); process.exit(0) })

// top-level await — no main() wrapper needed
```

Top-level `await` works out of the box (`"type": "module"` + Node ≥ 22.18).
Never wrap logic in an async `main()` function — it's unnecessary noise.

## Opening apps

```ts
// Browser (preferred — works with Chrome, Safari, Arc, Firefox)
const browser = App.defaultBrowser().open(url, FocusPolicy.Steal, Visibility.Show, true)
browser.enableAccessibility()   // always call this for browser windows
await sleep(3000)               // wait for AX tree to populate

// Native app by exact name
const notes = App.exactName('Notes').open(null, FocusPolicy.Steal, Visibility.Show, true)
await sleep(1500)
```

## Accessibility tree — prefer over vision when possible

The AX tree is free (no API call, no latency). Use it whenever the app
exposes stable labels. Fall back to grounding only when elements have no
accessible name.

```ts
// Attach to the currently focused window (reliable for multi-process browsers)
const tree = AccessibilityTree.fromForeground()

// Find by role
const headings = tree.find(TraversalOrder.DepthFirst, AriaRole.Heading, null, false, 20, true)

// Find by role + label substring
const btn = tree.find(TraversalOrder.DepthFirst, AriaRole.Button, 'Submit', false, 1, true)[0]

// Act on a node — refIds invalidate after every tree rebuild, so always
// resolve and act in the same tick; never stash a refId across awaits
if (btn?.refId !== undefined) tree.activate(btn.refId)
if (input?.refId !== undefined) tree.setValue(input.refId, 'hello')
```

## Vision grounding — for elements the AX tree doesn't expose

```ts
const model = GroundingModel.default()   // reads OPENROUTER_API_KEY automatically

// Shrink + compress before sending — cuts latency and cost
const shot = screenshotFull(true, Screen.mainScreen())
shot.shrink(1920, 1080)
shot.compress(70)

const [x, y] = model.ground(shot, 'submit button')
mouse.moveMouse(x, y, Coordinate.Abs)
mouse.button(Button.Left, Direction.Click)
```

Coordinates are **global physical pixels**, top-left origin. On a 2× Retina
display, a logical 1920×1080 screen is 3840×2160 physical — always work in
physical pixels.

## AskModel — for reasoning over screenshots

```ts
const ask = AskModel.default()   // reads OPENROUTER_API_KEY automatically

const shot = screenshotFull(true, Screen.mainScreen())
shot.shrink(1920, 1080)
shot.compress(70)

const response = ask.ask('What is the current score?', null, [shot])
```

For structured output, put the answer on the **last line** of the prompt's
expected response and parse it — the model will reliably put reasoning above
and the result at the bottom.

## Clipboard

```ts
new Clipboard().pasteText(longString)   // paste without clobbering clipboard history
```

## Mouse and keyboard

```ts
const mouse = new MouseController()
const kb    = new KeyboardController()

mouse.moveMouse(x, y, Coordinate.Abs)
mouse.button(Button.Left, Direction.Click)

kb.key(Key.Meta, Direction.Press)
kb.key(Key.C, Direction.Click)
kb.key(Key.Meta, Direction.Release)

kb.text('hello')   // types a string character by character
```

## Worker threads for parallel work

Use `Worker` from `node:worker_threads` when a blocking operation (e.g.
continuous screenshot analysis) would stall the main loop. Workers share the
parent process's macOS screen-capture permissions — unlike `child_process`,
they can call `screenshotFull` / `screenshotCropped` without permission
errors.

```ts
// main.ts
import { Worker } from 'node:worker_threads'
const worker = new Worker(new URL('./worker.ts', import.meta.url))
worker.on('message', (msg) => { /* handle threat state */ })

// worker.ts
import { screenshotCropped, Screen } from '@simular-ai/simulang-js'
import { parentPort } from 'node:worker_threads'
// ... analysis loop
parentPort?.postMessage({ threat: true })
```

## package.json shape

Every recipe `package.json` must have:

```json
{
  "type": "module",
  "engines": { "node": ">= 22.18" },
  "dependencies": {
    "@simular-ai/simulang-js": "^6.0.1"
  },
  "devDependencies": {
    "@types/node": "^25.x.x",
    "typescript": "^6.x.x"
  }
}
```

No root-level `package.json` or workspace. Each recipe is independent.

## tsconfig.json shape

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "noEmit": true,
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules"]
}
```

## Logging conventions

```ts
initLogger(null, 'warn')   // silence [info] mouse/key/screenshot chatter

// Section banners for long scripts
console.log('── Phase 1: Collecting data ────────────────')

// In-place progress (loops)
process.stdout.write(`\r  processed ${n} items`)
```

## Escape hatch pattern (long-running scripts)

Give users a way to stop without Ctrl+C:

```ts
function checkEscape() {
  const [mx, my] = new MouseController().location()
  const [sx, sy, sw, sh] = Screen.mainScreen().dimensions()
  if (mx < sx + 50 || mx > sx + sw - 50 || my < sy + 50 || my > sy + sh - 50) {
    console.log('\nCursor near screen edge — stopping.')
    process.exit(0)
  }
}
```

## What NOT to do

- Don't import from `@simular-ai/simulib-js` — retired, use `simulang-js`
- Don't stash `refId` values across `await` calls — they invalidate on every tree rebuild
- Don't use `GroundingModel` when the AX tree exposes the element — it's free and faster
- Don't wrap everything in `async function main()` — top-level `await` works
- Don't commit `.env` files, compiled binaries, or build output

## API reference

- **`index.d.ts`** in `node_modules/@simular-ai/simulang-js/` — full typed surface (~1700 lines with JSDoc)
- **`CLAUDE.md`** in the same folder — idioms, lifecycle rules, platform quirks
- Run `simulang which main.ts` inside a recipe folder to confirm which version is active
