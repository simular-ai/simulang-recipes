// Recipe — Wordle (Unlimited)
// Opens wordleunlimited.org and plays automatically.
// Strategy: start with a strong opener, then ask AskModel to deduce the next
// word from the coloured tile clues. Pure keyboard input — no coordinates needed.
//
// Run: simulang run main.ts
// Requires: OPENROUTER_API_KEY set

import {
  App, FocusPolicy, Visibility,
  KeyboardController, Key, Direction,
  MouseController, Button, Coordinate,
  screenshotFull, Screen, initLogger,
  AskModel,
} from '@simular-ai/simulang-js'

initLogger(null, 'warn')

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const kb  = new KeyboardController()
const ask = AskModel.default()

const OPENER = 'crane'   // strong statistical opener — change if you like

function takeShot() {
  const s = screenshotFull(true, Screen.mainScreen())
  s.shrink(1920, 1080)
  s.compress(70)
  return s
}

async function typeWord(word: string) {
  for (const ch of word.toUpperCase()) {
    kb.text(ch)
    await sleep(80)   // small gap so the game registers each keypress
  }
  await sleep(200)
  kb.key(Key.Return, Direction.Click)
}

// ─── Open game ────────────────────────────────────────────────────────────────

const mouse = new MouseController()

console.log('📝  Opening Wordle Unlimited…')
App.defaultBrowser().open('https://wordleunlimited.org', FocusPolicy.Steal, Visibility.Show, true)
await sleep(4000)

// Click the game board to give it keyboard focus
// The tile grid is always roughly centred horizontally and in the upper 2/3 of the page
const boardShot = takeShot()
const boardResp = ask.ask(
  'In this 1920×1080 Wordle screenshot, give the pixel coordinates of the CENTER of the 5×6 tile grid.\nReply ONLY: X: <integer>, Y: <integer>',
  null, [boardShot]
).trim()
const bxm = boardResp.match(/X:\s*(\d+)/i), bym = boardResp.match(/Y:\s*(\d+)/i)
const boardX = bxm ? +bxm[1] : 480   // fallback to typical position
const boardY = bym ? +bym[1] : 380
console.log(`    Board centre @ (${boardX}, ${boardY})`)

function focusBoard() {
  mouse.moveMouse(boardX, boardY, Coordinate.Abs)
  mouse.button(Button.Left, Direction.Click)
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

function makeReadPrompt(guessedSoFar: string[]): string {
  const history = guessedSoFar.length
    ? `Words already guessed (do NOT suggest any of these): ${guessedSoFar.join(', ')}`
    : ''
  return `You are playing Wordle. Look at this game board.
Each row shows a 5-letter guess with coloured tiles:
  GREEN  = correct letter, correct position
  YELLOW = correct letter, wrong position
  GRAY   = letter not in the word at all

Apply the constraints strictly:
- GREEN letters must stay in their exact position
- YELLOW letters must appear somewhere else in the word
- GRAY letters must not appear anywhere in the word

${history}

First, write one sentence of reasoning explaining the constraints you observed.
Then on the LAST LINE, write ONLY the 5-letter uppercase word — a real English dictionary word, no invented words.

If the puzzle is already solved (all green) or all rows are filled, write DONE on the last line.`
}

const CHECK_PROMPT = `Look at this Wordle board. Is the game over?
(Either all tiles in a row are green = win, or all 6 rows are filled = loss, or a result screen is visible.)
Reply ONLY: WIN, LOSS, or PLAYING`

// ─── Play ─────────────────────────────────────────────────────────────────────

const guessed = new Set<string>([OPENER.toUpperCase()])

console.log(`\nOpener: ${OPENER.toUpperCase()}\n`)
focusBoard()
await sleep(300)
await typeWord(OPENER)
await sleep(2500)

// Early win check after opener
{
  const s = takeShot()
  if (ask.ask(CHECK_PROMPT, null, [s]).trim().toUpperCase().startsWith('WIN')) {
    console.log('🎉  Solved on opener!')
    process.exit(0)
  }
}

for (let guess = 2; guess <= 6; guess++) {
  console.log(`── Guess ${guess} ─────────────────`)

  // Ask for the next word — retry until we get a fresh valid word
  let next = ''
  let attempts = 0
  while (attempts < 5) {
    attempts++
    const s    = takeShot()
    const resp = ask.ask(makeReadPrompt([...guessed]), null, [s]).trim()

    // Last line is the word, preceding lines are reasoning
    const lines    = resp.split('\n').map((l: string) => l.trim()).filter(Boolean)
    const lastLine = lines[lines.length - 1].toUpperCase().replace(/[^A-Z]/g, '')
    const reason   = lines.slice(0, -1).join(' ')

    if (reason) console.log(`  Reasoning: ${reason}`)
    console.log(`  Next guess: ${lastLine}`)

    if (lastLine === 'DONE') { console.log('  LLM says done.'); break }

    if (lastLine.length !== 5 || !/^[A-Z]{5}$/.test(lastLine)) {
      console.log(`  ⚠️  "${lastLine}" not valid — retrying`)
      continue
    }
    if (guessed.has(lastLine)) {
      console.log(`  ⚠️  "${lastLine}" already guessed — retrying`)
      continue
    }

    next = lastLine
    break
  }

  if (!next) { console.log('  Could not get a valid new word after 5 attempts.'); break }

  guessed.add(next)
  focusBoard()
  await sleep(300)
  await typeWord(next)
  await sleep(2500)

  // Check immediately after submitting
  const s = takeShot()
  const status = ask.ask(CHECK_PROMPT, null, [s]).trim().toUpperCase()
  console.log(`  Status: ${status}`)
  if (status.startsWith('WIN'))  { console.log('\n🎉  Solved it!'); break }
  if (status.startsWith('LOSS')) { console.log('\n😔  Out of guesses.'); break }
}

// Final status
const finalShot = takeShot()
const final = ask.ask(CHECK_PROMPT, null, [finalShot]).trim().toUpperCase()
console.log(`\nFinal: ${final}`)
