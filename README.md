# SimuLang Recipes

A collection of community-built automations for [Simulang](https://docs.simular.ai/simulang/simulang-primer). Browse what others have built, grab something useful, or share your own.

## What is Simulang?

Simulang is a CLI tool for automating real desktop apps — your browser, editor, native apps, and more. Scripts are TypeScript/JS files that interact with UIs through OS accessibility APIs, with optional AI-powered vision grounding for trickier elements. Check out the [primer](https://docs.simular.ai/simulang/simulang-primer) to get started.

## Running a Recipe

1. Get Simulang set up — the [primer](https://docs.simular.ai/simulang/simulang-primer) covers installation
2. Find a recipe below that looks useful
3. Open its folder and follow the `README.md`

## Recipes

| Recipe | Category | Description |
|--------|----------|-------------|
| [calendar-to-docs](calendar-to-docs/) | Productivity | Reads upcoming events from macOS Calendar via the accessibility tree and pastes a formatted month-grouped digest into a new Google Doc |
| [daily-news-digest](daily-news-digest/) | Productivity | Scrapes top headlines from CNN, NY Times, BBC, The Guardian, and Hacker News and writes a dated digest into a new Apple Notes note — no API keys required |
| [doomscroller](doomscroller/) | Social | Scrolls TikTok's For You feed and forwards videos that cross a like/share threshold to a friend on Slack |
| [mac-2048-player](mac-2048-player/) | Games | Expectimax bot that plays 2048 (Mac App Store) using vision grounding for UI navigation and the accessibility tree for board state |
| [redmart-shopper](redmart-shopper/) | Productivity | Weekly grocery automation for Redmart (Lazada SG) — fills your cart every Saturday from a managed shopping list |
| [nudge](nudge/) | Productivity | Keeps your presence status active with imperceptible cursor micro-movements every 30 seconds — cursor always snaps back, no API keys required |
| [simple-profiler](simple-profiler/) | Dev Tools | Compiles and runs a C++ sorting benchmark, then pastes a formatted profiling report into Apple Notes |
| [slitherio](slitherio/) | Games | Plays slither.io automatically — steers with orbit patterns and uses pixel-level screenshot analysis to detect threats and snap into a defensive spin |
| [wordle](wordle/) | Games | Plays Wordle Unlimited automatically — opens with "CRANE" then uses AskModel each turn to read the board and pick the next guess |

Got something to share? We'd love to see it — check out [CONTRIBUTING.md](CONTRIBUTING.md).

## Resources

- [Simulang Docs](https://docs.simular.ai/simulang/simulang-primer)
- [Simular Website](https://www.simular.ai/)
