# SimuLang Recipes

A collection of community-built automations for [Simulang](https://docs.simular.ai/simulang/simulang-primer). Browse what others have built, grab something useful, or share your own.

## What is Simulang?

Simulang is a CLI tool for automating real desktop apps — your browser, editor, native apps, and more. Scripts are TypeScript/JS files that interact with UIs through OS accessibility APIs, with optional AI-powered vision grounding for trickier elements. Check out the [primer](https://docs.simular.ai/simulang/simulang-primer) to get started.

> **Requirements:** macOS only · Node ≥ 22.18 · [simulang](https://docs.simular.ai/simulang/simulang-primer) installed · Screen Recording + Accessibility permissions granted to your terminal (run `simulang setup` once)

## API Key Setup

Some recipes use vision grounding or `AskModel` and require an [OpenRouter](https://openrouter.ai) API key. Set it once and every recipe that needs it will pick it up automatically:

```bash
# Add to ~/.zshrc or ~/.zprofile, then open a new terminal
export OPENROUTER_API_KEY=your_key_here
```

Each recipe's README states whether a key is required.

## Running a Recipe

Try the simplest recipe first — no API key, no extra setup:

```bash
cd nudge
npm install
simulang run main.ts
```

For any other recipe: `cd <recipe>`, read its `README.md` for prerequisites, then `simulang run main.ts`.

## Recipes

| Recipe | Category | Description | Key APIs |
|--------|----------|-------------|----------|
| [calendar-to-docs](calendar-to-docs/) | Productivity | Reads upcoming events from macOS Calendar via the accessibility tree and pastes a formatted month-grouped digest into a new Google Doc | `AccessibilityTree`, `GroundingModel`, `Clipboard` |
| [daily-news-digest](daily-news-digest/) | Productivity | Scrapes top headlines from CNN, NY Times, BBC, The Guardian, and Hacker News and writes a dated digest into a new Apple Notes note | `AccessibilityTree`, `Clipboard`, `KeyboardController` |
| [doomscroller](doomscroller/) | Social | Scrolls TikTok's For You feed and forwards videos that cross a like/share threshold to a friend on Slack | `AccessibilityTree`, `GroundingModel`, `Clipboard` |
| [mac-2048-player](mac-2048-player/) | Games | Expectimax bot that plays 2048 (Mac App Store) using vision grounding for UI navigation and the accessibility tree for board state | `AccessibilityTree`, `GroundingModel`, `MouseController` |
| [redmart-shopper](redmart-shopper/) | Productivity | Weekly grocery automation for Redmart (Lazada SG) — fills your cart every Saturday from a managed shopping list | `AskModel`, `GroundingModel`, `KeyboardController` |
| [nudge](nudge/) | Productivity | Keeps your presence status active with imperceptible cursor micro-movements every 30 seconds — cursor always snaps back | `MouseController` |
| [simple-profiler](simple-profiler/) | Dev Tools | Compiles and runs a C++ sorting benchmark, then pastes a formatted profiling report into Apple Notes | `App`, `Clipboard`, `KeyboardController` |
| [slitherio](slitherio/) | Games | Plays slither.io automatically — main thread steers with orbit patterns, worker thread does pixel-level threat detection | `GroundingModel`, `AskModel`, `Worker threads` |
| [wordle](wordle/) | Games | Plays Wordle Unlimited automatically — opens with "CRANE" then uses AskModel each turn to read the board and pick the next guess | `AskModel`, `KeyboardController` |

Got something to share? We'd love to see it — check out [CONTRIBUTING.md](CONTRIBUTING.md).

## Resources

- [Simulang Docs](https://docs.simular.ai/simulang/simulang-primer)
- [Simular Website](https://www.simular.ai/)
