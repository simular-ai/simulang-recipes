// Recipe — Calendar to Docs
// Opens the macOS Calendar app in week view, reads upcoming events directly
// from the accessibility tree, then opens Safari and writes a formatted list
// into a new Google Doc.
//
// Run: simulang run main.ts
// Requires: signed into Google in Safari, OPENROUTER_API_KEY set

import {
  App,
  FocusPolicy,
  Visibility,
  AccessibilityTree,
  TraversalOrder,
  Clipboard,
  KeyboardController,
  Key,
  Direction,
  GroundingModel,
  MouseController,
  Button,
  Coordinate,
  screenshotFull,
  Screen,
} from '@simular-ai/simulang-js'

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const kb = new KeyboardController()
const mouse = new MouseController()

const MONTHS = 3

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// ─── Phase 1: Open Calendar in week view and read events ──────────────────────
//
// In week view, Calendar exposes events as role=77 (StaticText) nodes with:
//   value  = event title (e.g. "Mother's Day", "Weekly Kickoff")
//   overall = "statictext text {title} under {dayofweek}"
//
// The actual date isn't in the AX tree, but we can compute it from the week
// offset (w) and the day name extracted from overallDescription.

interface CalEvent {
  date: Date
  dateStr: string
  name: string
}

console.log('📅  Opening Calendar…')
const cal = App.exactName('Calendar').open(null, FocusPolicy.Steal, Visibility.Show, true)
cal.enableAccessibility()
await sleep(2000)

// Switch to week view (Cmd+2), jump to today (Cmd+T)
kb.key(Key.Meta, Direction.Press)
kb.key(Key.Num2, Direction.Click)
kb.key(Key.Meta, Direction.Release)
await sleep(600)
kb.key(Key.Meta, Direction.Press)
kb.key(Key.T, Direction.Click)
kb.key(Key.Meta, Direction.Release)
await sleep(800)

const now = new Date()
const WEEKS = Math.ceil(MONTHS * 4.5)
const allEvents: CalEvent[] = []
const seenKeys = new Set<string>()

// Sunday of the current week
const weekSundayBase = new Date(now)
weekSundayBase.setDate(now.getDate() - now.getDay())
weekSundayBase.setHours(0, 0, 0, 0)

console.log(`  Scanning ${WEEKS} weeks…`)

for (let w = 0; w < WEEKS; w++) {
  const tree = AccessibilityTree.fromForeground()
  const nodes = tree.find(TraversalOrder.DepthFirst, null, null, false, 3000, false)

  for (const n of nodes) {
    // Events in week view: role=77, value = event name, overall ends "under {dayname}"
    if (n.role !== 77) continue
    if (!n.value || n.value.length < 2) continue
    if (/^\d+$/.test(n.value)) continue // skip day numbers
    if (n.description?.includes('belongs to calendar')) continue // skip AX membership nodes

    // Must anchor to a day of week (not "under may 2026", "under calendar", etc.)
    const dayMatch = n.overallDescription?.match(/under (sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/i)
    if (!dayMatch) continue

    const dayIndex = DAY_NAMES.findIndex((d) => d.toLowerCase() === dayMatch[1].toLowerCase())
    const eventDate = new Date(weekSundayBase)
    eventDate.setDate(weekSundayBase.getDate() + w * 7 + dayIndex)

    const dateStr = eventDate.toLocaleDateString('en-SG', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    const key = `${dateStr}|${n.value}`
    if (!seenKeys.has(key)) {
      seenKeys.add(key)
      allEvents.push({ date: eventDate, dateStr, name: n.value })
    }
  }

  if (w < WEEKS - 1) {
    kb.key(Key.Meta, Direction.Press)
    kb.key(Key.RightArrow, Direction.Click)
    kb.key(Key.Meta, Direction.Release)
    await sleep(600)
  }
}

// Sort by date and drop anything before today
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
allEvents.sort((a, b) => a.date.getTime() - b.date.getTime())
const upcomingEvents = allEvents.filter((e) => e.date >= today)
console.log(
  `  ${upcomingEvents.length} upcoming events found (${allEvents.length - upcomingEvents.length} past events skipped)`,
)

if (upcomingEvents.length === 0) {
  console.log('\n⚠️  No upcoming events found. Make sure calendars are visible in Calendar.app.')
  process.exit(1)
}

// ─── Phase 2: Format the document ────────────────────────────────────────────

const endDate = new Date(now.getFullYear(), now.getMonth() + MONTHS - 1, 1)
const fromStr = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`
const toStr = `${MONTH_NAMES[endDate.getMonth()]} ${endDate.getFullYear()}`
const rangeStr = fromStr === toStr ? fromStr : `${fromStr} – ${toStr}`

const generatedOn = now.toLocaleDateString('en-SG', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

let doc = `Calendar — ${rangeStr}\nGenerated on ${generatedOn}\n\n`

// Group by month
const byMonth = new Map<string, CalEvent[]>()
for (const e of upcomingEvents) {
  const key = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, '0')}`
  if (!byMonth.has(key)) byMonth.set(key, [])
  byMonth.get(key)!.push(e)
}

for (const [, events] of byMonth) {
  const first = events[0].date
  const monthLabel = `${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()}`
  doc += `── ${monthLabel} ──────────────────────────\n\n`
  for (const e of events) {
    const dayLabel = e.date.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric' })
    doc += `  ${dayLabel}\n  • ${e.name}\n\n`
  }
}

console.log('\n' + doc)

// ─── Phase 3: Open Safari → new Google Doc ───────────────────────────────────

console.log('🌐  Opening Safari → Google Docs…')
const safari = App.exactName('Safari').open('https://docs.new', FocusPolicy.Steal, Visibility.Show, true)
safari.enableAccessibility()
await sleep(5000)

console.log('🔍  Locating document body…')
const model = GroundingModel.default()
const screenshot = screenshotFull(true, Screen.mainScreen())
const [bodyX, bodyY] = model.ground(screenshot, 'document body text area below the title')
mouse.moveMouse(bodyX, bodyY, Coordinate.Abs)
mouse.button(Button.Left, Direction.Click)
await sleep(400)

new Clipboard().pasteText(doc)
await sleep(500)

console.log('✅  Done! Your calendar is in Google Docs.')
