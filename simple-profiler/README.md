# Simple Profiler

## Description

Compiles and runs a C++ sorting benchmark, then opens Apple Notes and pastes a formatted profiling report. Demonstrates simulang's ability to cross native app boundaries — shell tools, file system, and desktop app automation all in one script.

The benchmark compares three sorting implementations across four array sizes (1k, 5k, 10k, 50k elements), making the O(n²) vs O(n log n) complexity difference immediately visible in the numbers.

## Key APIs Used

- `File` (Node `node:child_process`) — compiles `main.cpp` via `clang++ -O2` and runs the binary, capturing stdout
- `App.exactName('Notes').open()` — launches Apple Notes
- `Instance.focus()` — ensures Notes has keyboard focus before pasting
- `KeyboardController` + `Key.Meta` + `Key.N` — creates a new note (Cmd+N)
- `Clipboard.pasteText()` — pastes the formatted report into the note body

## How to Run

**Prerequisites:**
- Simulang installed (`simulang run` available in your terminal)
- No API key required
- Xcode Command Line Tools (`xcode-select --install`) for `clang++`
- `npm install` run once in this folder

**Steps:**
1. `cd simple-profiler`
2. `simulang run main.ts`

Note: bubble sort on 50k elements (averaged 3 runs) will take a few minutes — this is intentional, the slowdown is the point.

## Workflow Diagram

```
[Compile main.cpp with clang++ -O2]
  → [Run binary, capture timing output]
  → [Parse results into structured rows]
  → [Generate report with observations]
  → [Open Notes → Cmd+N → pasteText()]
```

## What the Report Shows

```
Size      BubbleSort (ms)   MergeSort (ms)   std::sort (ms)
────────────────────────────────────────────────────────────
1000      ~3                ~0.05            ~0.03
5000      ~80               ~0.3             ~0.15
10000     ~320              ~0.6             ~0.35
50000     ~8000             ~3.5             ~1.8
```

The numbers make it viscerally clear why algorithm choice matters: bubble sort at 50k is thousands of times slower than `std::sort` on the same input.
