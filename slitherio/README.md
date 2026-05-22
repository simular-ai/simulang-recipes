# Slither.io

## Description

Opens slither.io, enters a nickname, and plays automatically using two concurrent threads. The main thread runs a 50ms movement loop that steers the snake through alternating wide and tight orbit patterns. A background worker thread continuously analyses screenshots using pixel-level connected-components detection to spot enemy snakes — no vision API calls, sub-200ms latency. On threat, the snake snaps into a tight defensive spin that is very difficult for human players to intercept. Hold **Shift** at any time to take manual control; release and the bot resumes after 3 seconds.

## Demo

![Demo](demo.gif)

## Key APIs Used

**Main thread**
- `App.defaultBrowser().open()` — opens slither.io
- `AccessibilityTree` + `setValue()` — fills the nickname field via the AX tree
- `GroundingModel.default()` — used twice at startup: to click the Play button and to locate the snake's eyes for precise canvas calibration
- `initLogger(null, 'warn')` — silences verbose simulang mouse/screenshot logs
- `MouseController.moveMouse()` — steers the snake by orbiting the cursor around the canvas centre
- `KeyboardController` + `Key.VolumeMute` — spams the mute key as a visible panic indicator
- `Worker` (Node worker threads) — runs the pixel detection loop in parallel without blocking movement

**Worker thread**
- `screenshotCropped()` — captures a 1200×800 region centred on the snake
- `Screenshot.base64()` — extracts image data without touching disk
- `Jimp.read()` — decodes the image in memory for pixel access
- Connected-components BFS with 8px radius connectivity — counts distinct bright regions after brightness thresholding; ≥ 2 large components = enemy present
- `AskModel.default().ask()` — checks every 30 iterations whether the game-over screen is visible (the only API call in the hot loop)

## How to Run

**Prerequisites:**
- Simulang installed (`simulang run` available in your terminal)
- `OPENROUTER_API_KEY` required — [see setup instructions](../README.md#api-key-setup)
- `npm install` run once in this folder
- macOS (uses `osascript` for Shift key detection)

**Steps:**
1. `cd slitherio`
2. `simulang run main.ts`

Hold **Shift** to take manual control. The bot resumes 3 seconds after you release.

## Workflow Diagram

```
[Open slither.io]
  → [AX tree: set nickname "_"]
  → [Vision grounding: click Play]
  → [Vision grounding: find snake eyes → calibrate (cx, cy)]
  → [Triple-tap mute as startup sanity check]

Main thread (50ms ticks):
  [Check Shift → manual override?]
  → [Orbit cursor: wide loop ↔ tight loop, alternating direction]
  → [On panic: switch to micro panic-spin radius]
  → [Mute spam every 5 ticks while panicking]

Worker thread (parallel, ~150–200ms per cycle):
  [screenshotCropped 1200×800 → base64 → Jimp decode]
  → [Brightness threshold → binary map]
  → [BFS connected components, 8px radius]
  → [≥ 2 large components → postMessage({ threat: true })]
  → [Every 30 iterations: AskModel game-over check]
  → [Save debug_binary.png to simulang-experiments/ every 20 iterations]

Main receives postMessage → PANIC ON/OFF → terminate on game over
```

## Notes

- **Calibration** — the snake's head is always at the centre of the game canvas. Grounding on the snake's eyes at startup gives the exact pixel coordinates regardless of browser chrome height or window position.
- **Connected components** — bright pixels (average RGB > 80) are thresholded into a binary map. The 8px connectivity radius bridges small gaps in the snake body without merging well-separated food pellets. `MIN_COMPONENT_SIZE = 800` filters out pellets and glow effects.
- **Debug image** — every 20 worker iterations a black-and-white `debug_binary.png` is saved to your `simulang-experiments/` folder showing exactly what the algorithm sees. Open it to tune `BRIGHTNESS_THRESH` and `MIN_COMPONENT_SIZE`.
- **Concurrency** — worker threads share the parent process's screen capture permissions (unlike spawned child processes on macOS), which is why the detection loop lives in a `Worker` rather than a `child_process.spawn`.
- **Manual override** — `isShiftHeld()` uses `osascript` with JXA to read `NSEvent.modifierFlags` directly, checking every 5 ticks (~250ms) so it doesn't block the movement loop.
