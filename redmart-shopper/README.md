# Redmart Shopper

## Description

Weekly grocery automation for Redmart (Lazada SG). Manage your shopping list in a local web app, then let a Simulang script fill your Redmart cart every Saturday. Review and pay — the bot does the rest.

## Demo

![Demo](demo.gif)

## Key APIs Used

- `AskModel.ask()` — reasons about search results to pick the best product and quantity combination
- `GroundingModel` + `screenshot.ground()` — visually locates and clicks buttons (Add to Cart, Select All, Delete, etc.)
- `App.defaultBrowser().open()` — focuses the browser and navigates to URLs
- `KeyboardController` — uses Cmd+L to navigate the address bar without opening new tabs
- `screenshotFull()` + `Image.fromBase64()` — captures the screen for vision model queries

## How to Run

**Prerequisites:**
- simulang installed and logged in (`simulang --version` to check)
- `OPENROUTER_API_KEY` required — [see setup instructions](../README.md#api-key-setup)
- macOS with **Screen Recording** and **Automation** permissions granted to your terminal (System Settings → Privacy & Security)
- Safari or Chrome — the script uses AppleScript to locate the browser window; other browsers are not supported
- Logged in to your Redmart account in Safari or Chrome
- Node.js 22+

**Steps:**
1. `cd redmart-shopper`
2. `npm install`
3. `npm run client` — builds and starts the shopping list app at **http://localhost:4359**
4. Add your groceries in the app, then click **Save**
5. Test run: `simulang run scripts/main.ts -- --force`

Each item has three fields:

| Field | What to enter |
|-------|---------------|
| **Name** | What you call it, e.g. `Oat Milk` |
| **Description** | Specific details for the bot, e.g. `Oatside 1L oat milk` — the more specific, the better |
| **Qty** | Weekly quantity. If the description says `1L` and qty is `3`, the bot will pick 3× 1L or 1× 3L, whichever makes more sense |

**Chat assistant (optional):** the app has a built-in chat panel. Describe what you eat, upload receipt or fridge photos, and it will update your list automatically.

Add `--verbose` to see model responses, click coordinates, and navigation steps:
```bash
simulang run scripts/main.ts -- --force --verbose
```

**To schedule (every Saturday at 9am):**

Find your paths first:
```bash
cd redmart-shopper && pwd   # copy this
which simulang              # copy this too
```

Open your crontab (`crontab -e`) and add:
```
0 9 * * 6 cd /path/to/redmart-shopper && /path/to/simulang run scripts/main.ts >> /tmp/redmart-shopper.log 2>&1
```

The `6` means Saturday. The script also checks that at least 7 days have passed since the last run — so if you ran `--force` mid-week it won't double-shop. Use `--force` to bypass both checks.

## Workflow Diagram

```
[9am daily — cron job]
         │
         ▼
  Is today Saturday?  ──no──▶  exit silently
         │ yes
         ▼
  >= 7 days since     ──no──▶  log "next shop: <date>" → exit
  last purchase?
         │ yes
         ▼
  Set cartStatus = "adding"
  Write save.json
         │
         ▼
  ┌─────────────────────────────────────────┐
  │  For each item in shoppingList:         │
  │                                         │
  │  Search Redmart for item.name           │
  │       ↓                                 │
  │  Ask model picks best product +         │
  │  calculates how many units to add       │
  │  (e.g. need 3× 1L → picks 3× 1L pack   │
  │   or 1× 3L if available)               │
  │       ↓                                 │
  │  Grounding model clicks Add to Cart     │
  │       ↓                                 │
  │  If qty > 1: clicks + stepper           │
  │       ↓                                 │
  │  If no product found: skip item, warn   │
  └─────────────────────────────────────────┘
         │
         ▼
  Open cart in browser
  Set cartStatus = "ready"
  Set lastPurchaseDate = today
  Write save.json
         │
         ▼
  [You review cart and pay on Redmart]
```

## save.json Schema

```json
{
  "lastPurchaseDate": "2026-05-17",
  "cartStatus": "ready",
  "shoppingList": [
    {
      "id": "oat-milk",
      "name": "Oat Milk",
      "description": "Oatside 1L oat milk",
      "qty": 3
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `lastPurchaseDate` | Date of the last completed shop run (`YYYY-MM-DD`) |
| `cartStatus` | `pending` / `adding` / `ready` / `error` — see below |
| `shoppingList[].name` | Display name shown in the app |
| `shoppingList[].description` | Buying spec used by the AI to pick the right product |
| `shoppingList[].qty` | Total quantity to buy |

| `cartStatus` | Meaning |
|--------------|---------|
| `pending` | No run this week yet |
| `adding` | Bot is currently adding items |
| `ready` | Cart is loaded — go pay |
| `error` | Script failed — check logs |

## Notes

- **Why no auto-checkout?** Payment is irreversible. The bot always stops at a populated cart so you stay in control.
- **Bot picks wrong products?** Make the description more specific — include brand, exact size, and any distinguishing details.
- **To stop a run mid-way:** Move your cursor to any corner of the screen — the script checks between actions and exits cleanly. You can also press `Ctrl+C` in the terminal.
- **Redmart login:** The bot uses your existing browser session — make sure you're logged in before the Saturday run.
- **Check the log after a Saturday run:** `cat /tmp/redmart-shopper.log`
