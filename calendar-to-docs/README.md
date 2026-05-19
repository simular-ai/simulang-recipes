# Calendar to Docs

## Description

Opens macOS Calendar in week view, reads upcoming events for the next 3 months directly from the OS accessibility tree, then opens Safari and pastes a formatted calendar digest into a new Google Doc — grouped by month, with past events automatically filtered out. Works with any calendar visible in Calendar.app: holidays, work meetings, personal events.

## Key APIs Used

- `App.exactName('Calendar').open()` — launches Calendar and returns a live process handle
- `instance.enableAccessibility()` — activates the accessibility tree for the app
- `AccessibilityTree.fromForeground()` + `find()` — walks the Calendar week view tree; events appear as `StaticText` nodes whose `value` is the event title and `overallDescription` anchors them to a day of week
- `KeyboardController` — switches to week view (Cmd+2), jumps to today (Cmd+T), navigates forward week by week (Cmd+→)
- `GroundingModel.default()` + `screenshotFull()` — locates the Google Docs body area visually, since the editor places the cursor in the title field by default
- `MouseController` — clicks the grounding coordinates to focus the body
- `Clipboard.pasteText()` — inserts the full formatted document in one shot

## How to Run

**Prerequisites:**
- Simulang installed (`simulang run` available in your terminal)
- macOS with at least one calendar visible in Calendar.app
- Signed into your Google account in Safari
- `OPENROUTER_API_KEY` set in your environment (for vision grounding)
- `npm install` run once in this folder

**Steps:**
1. `cd calendar-to-docs`
2. `simulang run main.ts`

The script navigates 14 weeks of Calendar (≈ 3 months) at 600ms per week, taking around 10–15 seconds to collect events before opening Safari.

## Workflow Diagram

```
[Open Calendar → week view → today]
  → [Navigate 14 weeks, reading AX tree each week]
  → [Extract event titles from StaticText nodes]
  → [Compute full dates from week offset + day name]
  → [Filter to upcoming events only, group by month]

[Open Safari → https://docs.new]
  → [Vision grounding: click document body]
  → [Clipboard.pasteText(): insert formatted digest]
```

## Notes

- **Scan range** — controlled by `MONTHS` at the top of `main.ts`. Set to `3` by default; increase to `12` to scan a full year (takes proportionally longer).
- **All calendars included** — holidays, work events, and personal events are all captured. Events from every calendar visible in Calendar.app appear in the output.
- **Past events filtered** — only events from today onward are included in the document.
- **Google sign-in required** — `https://docs.new` creates a new document if you're signed in; otherwise Safari shows a login page instead.
- **Why week view?** macOS Calendar's month view exposes event *existence* (coloured dots) but not event *names* in the accessibility tree. Week view renders events as labelled blocks whose titles are directly readable.
