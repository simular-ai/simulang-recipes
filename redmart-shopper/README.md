# Redmart Shopper

A two-part weekly grocery automation. A local HTML tool lets you upload receipts — an LLM analyzes your buying patterns and generates a standing weekly shopping list. Every weekend, a Simulang script reads that list, fills your Redmart cart, and opens it in the browser so you just review and pay.

## Components

```
redmart-shopper/
├── README.md
├── receipt-analyzer.html   # Upload receipts → derive item profiles → LLM generates weeklyShoppingList
├── main.ts                 # Entry point: checks schedule, orchestrates the weekly run
├── shopper.ts              # Redmart browser automation (search, add to cart, open cart)
├── config.ts               # User-editable settings
├── save.json               # Runtime state (gitignored)
├── save.json.example       # Schema reference with example values
└── package.json
```

## Architecture

```
┌──────────────────────────────┐        ┌──────────────────┐
│    receipt-analyzer.html     │        │    config.ts     │
│                              │        │  (user settings) │
│  ┌────────────────────────┐  │        └────────┬─────────┘
│  │  drag-and-drop upload  │  │                 │ reads
│  │  (JPG, PNG, PDF)       │  │                 ▼
│  └───────────┬────────────┘  │   ┌─────────────────────────┐
│              ▼               │   │         main.ts          │
│  ┌────────────────────────┐  │   │  schedule check +        │
│  │  OpenRouter vision LLM │  │   │  orchestration           │
│  │  extract items from    │  │   └────────────┬────────────┘
│  │  each receipt          │  │                │
│  └───────────┬────────────┘  │                ▼
│              ▼               │   ┌─────────────────────────┐
│  ┌────────────────────────┐  │   │        shopper.ts        │
│  │  derive itemProfiles   │  │   │  search → add to cart → │
│  │  (frequency, qty)      │  │   │  open cart in browser   │
│  └───────────┬────────────┘  │   └────────────┬────────────┘
│              ▼               │                │
│  ┌────────────────────────┐  │                │ opens
│  │  OpenRouter LLM:       │  │                ▼
│  │  "given these buying   │  │   ┌─────────────────────────┐
│  │  patterns, what qty    │  │   │   Redmart cart in       │
│  │  to order weekly?"     │  │   │   browser (user pays)   │
│  └───────────┬────────────┘  │   └─────────────────────────┘
└──────────────┼───────────────┘
               │ File System Access API (read + write)
               ▼
  ┌────────────────────────────────────────────────────┐
  │                     save.json                      │
  │  itemProfiles[]  │  weeklyShoppingList[]           │
  │  lastPurchaseDate  │  cartStatus                   │
  └────────────────────────────────────────────────────┘
```

## Workflow

### Phase 1 — Receipt ingestion (manual, run whenever you have new receipts)

```
┌─────────────────────────────────┐
│      receipt-analyzer.html      │
│                                 │
│  ┌───────────────────────────┐  │
│  │  upload receipts          │  │
│  │  (JPG, PNG, PDF)          │  │
│  └─────────────┬─────────────┘  │
│                │                │
│                ▼                │
│  ┌───────────────────────────┐  │
│  │  OpenRouter vision LLM    │  │
│  │  per receipt: extract     │  │
│  │  date, store, items, qty  │  │
│  └─────────────┬─────────────┘  │
│                │                │
│                ▼                │
│  ┌───────────────────────────┐  │
│  │  normalize + deduplicate  │  │
│  │  build itemProfiles[]     │  │
│  │  (occurrences, avgQty,    │  │
│  │   lastBoughtDate)         │  │
│  └─────────────┬─────────────┘  │
│                │                │
│                ▼                │
│  ┌───────────────────────────┐  │
│  │  OpenRouter LLM           │  │
│  │  prompt: "given these     │  │
│  │  buying patterns, what    │  │
│  │  qty of each item should  │  │
│  │  go in a weekly order?"   │  │
│  └─────────────┬─────────────┘  │
└───────────────┼─────────────────┘
                │ File System Access API
                ▼
┌───────────────────────────────────┐
│             save.json             │
│  itemProfiles[]      ← updated    │
│  weeklyShoppingList[] ← updated   │
│  lastPurchaseDate    (unchanged)  │
│  cartStatus          (unchanged)  │
└───────────────────────────────────┘
```

### Phase 2 — Weekly shop (runs every weekend via cron, or manually)

```
┌──────────────────────┐
│       main.ts        │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐  no  ┌──────────────────────────────┐
│  save.json exists?   │─────▶│  exit: "run receipt-         │
└──────────┬───────────┘      │   analyzer.html first"       │
           │ yes              └──────────────────────────────┘
           ▼
┌──────────────────────────┐  no  ┌──────────────────────────┐
│  weeklyShoppingList      │─────▶│  exit: "list is empty —  │
│  non-empty?              │      │  upload more receipts"   │
└──────────┬───────────────┘      └──────────────────────────┘
           │ yes
           ▼
┌──────────────────────────┐  no  ┌──────────────────────────┐
│  today >=                │─────▶│  log "next shop due      │
│  lastPurchaseDate + 7?   │      │  on <date>" → exit       │
└──────────┬───────────────┘      └──────────────────────────┘
           │ yes
           ▼
┌──────────────────────────┐
│  cartStatus = "adding"   │
│  write save.json         │
└──────────┬───────────────┘
           │
           ▼
┌───────────────────────────────────────────┐
│                 shopper.ts                │
│                                           │
│  ┌─────────────────────────────────────┐  │
│  │  for each item in weeklyShoppingList│  │
│  │                                     │  │
│  │  ┌───────────────────────────────┐  │  │
│  │  │  open Redmart search page     │  │  │
│  │  └──────────────┬────────────────┘  │  │
│  │                 │                   │  │
│  │                 ▼                   │  │
│  │  ┌───────────────────────────────┐  │  │
│  │  │  read results via a11y tree   │  │  │
│  │  └──────────────┬────────────────┘  │  │
│  │                 │                   │  │
│  │                 ▼                   │  │
│  │  ┌───────────────────────────────┐  │  │
│  │  │  fuzzy match result to item   │  │  │
│  │  │  confident? ──yes──▶ add qty  │  │  │
│  │  │      │               to cart  │  │  │
│  │  │      no                       │  │  │
│  │  │      ▼                        │  │  │
│  │  │  ground(model, item.name)     │  │  │
│  │  │  ──────────────────▶ add qty  │  │  │
│  │  │                      to cart  │  │  │
│  │  └───────────────────────────────┘  │  │
│  └─────────────────────────────────────┘  │
└──────────────────┬────────────────────────┘
                   │
                   ▼
     ┌─────────────────────────┐
     │  open /cart in browser  │
     │  bring window to focus  │
     └─────────────┬───────────┘
                   │
                   ▼
     ┌──────────────────────────────┐
     │  update save.json:           │
     │  lastPurchaseDate = today    │
     │  cartStatus = "ready"        │
     └──────────────┬───────────────┘
                    │
                    ▼
     ┌──────────────────────────────┐
     │   user reviews cart          │
     │   and pays on Redmart        │
     └──────────────────────────────┘
```

## save.json Schema

Single source of truth for all runtime state. Gitignored, created on first receipt upload.

```json
{
  "lastPurchaseDate": "2026-05-18",
  "cartStatus": "pending",
  "itemProfiles": [
    {
      "normalizedName": "oat milk",
      "occurrences": 6,
      "avgQtyPerShop": 2,
      "lastBoughtDate": "2026-05-12",
      "category": "dairy"
    }
  ],
  "weeklyShoppingList": [
    {
      "normalizedName": "oat milk",
      "searchQuery": "oat milk 1L",
      "qty": 2,
      "category": "dairy"
    }
  ]
}
```

### `cartStatus` values

| Value | Meaning |
|-------|---------|
| `"pending"` | Weekly list exists but shop hasn't run yet |
| `"adding"` | Script is currently adding items to cart |
| `"ready"` | All items added, cart tab opened in browser |
| `"error"` | Script failed mid-run — check logs |

### Auto-update moments

| Event | What updates in save.json |
|-------|--------------------------|
| Receipt uploaded | `itemProfiles[]`, `weeklyShoppingList[]` |
| Weekly shop completes | `lastPurchaseDate`, `cartStatus` |

## config.ts Schema

```ts
export const config = {
  openRouterApiKey: process.env.OPENROUTER_API_KEY,
  redmartUrl: "https://redmart.lazada.sg",
  saveFilePath: "./save.json",
  minItemOccurrences: 2,   // ignore items seen in fewer than N receipts
  maxItemsPerShop: 30,     // safety cap on cart size
}
```

## receipt-analyzer.html

A self-contained HTML page — no server required, runs entirely in the browser.

- Accepts JPG, PNG, and PDF uploads via drag-and-drop or file picker
- Sends each file to OpenRouter (vision model) to extract: date, store name, line items (name, qty), total
- Normalizes and deduplicates item names across receipts to build `itemProfiles[]`
- Sends `itemProfiles[]` to OpenRouter LLM with the prompt: *"Given these buying patterns, what quantity of each item should go in a weekly grocery order?"*
- LLM returns `weeklyShoppingList[]`
- Reads existing `save.json` via File System Access API, merges updates, writes back

Items with fewer than `minItemOccurrences` receipts are excluded — filters out one-off purchases.

## main.ts

1. Reads and validates `save.json` — exits with a clear error if missing or malformed
2. Checks `weeklyShoppingList` is non-empty
3. Checks `today >= lastPurchaseDate + 7` — exits early with next due date if not
4. Sets `cartStatus = "adding"`, writes `save.json`
5. Calls `shopper.ts` with `weeklyShoppingList`
6. On success: sets `lastPurchaseDate = today`, `cartStatus = "ready"`, writes `save.json`
7. Opens `https://redmart.lazada.sg/cart` in the default browser

## shopper.ts

Drives the Redmart browser UI via Simulang. For each item in `weeklyShoppingList`:

1. Navigate to Redmart search with `item.searchQuery`
2. Read first 3–5 results from the accessibility tree
3. Fuzzy-match the best result against `item.normalizedName`
4. If no confident match: fall back to `screenshot.ground(model, item.normalizedName)`
5. Add `item.qty` units to cart
6. Brief delay between items to avoid rate limiting

After all items: navigate to `/cart` and bring the browser window to focus.

### Key APIs Used

- `App.defaultBrowser().open(url)` — navigates to Redmart search and cart pages
- `AccessibilityTree.fromForeground()` — reads search results and product names
- `screenshot.ground(model, concept)` — fallback for items the tree can't match
- `MouseController` — clicks add-to-cart and quantity buttons

## How to Run

**Prerequisites:**
- `simulang` installed
- `OPENROUTER_API_KEY` set in your environment
- macOS screen recording permission granted to your terminal

**First-time setup:**
1. `cd redmart-shopper && npm install`
2. Open `receipt-analyzer.html` in your browser
3. Upload 2–3 weeks of grocery receipts
4. Review `save.json` — check `weeklyShoppingList` looks right, adjust qty if needed

**Weekly run:**
```
simulang run main.ts
```

Or schedule it via cron:
```
# every Sunday at 9am
0 9 * * 0 cd /path/to/redmart-shopper && simulang run main.ts
```

**To refresh your shopping list:** re-open `receipt-analyzer.html` and upload newer receipts — it will re-derive profiles and regenerate the weekly list.

**To stop mid-run:** move your cursor to a corner of the screen or switch to another window.

## Notes

- **Why fixed weekly cadence?** Consolidating into one weekly order minimises delivery fees. The LLM adjusts quantities to match actual consumption rates rather than ordering every item every week at full quantity.
- **Why no LLM at run time?** The weekly list is generated once at analysis time and stored. The shop script just executes it — no model cost or latency during the run.
- **Why File System Access API?** Avoids needing a local server. The browser reads and writes `save.json` directly with a one-time folder permission grant.
- **Why no auto-checkout?** Payment is irreversible. The script stops at a populated cart so you stay in control.
- **Redmart search reliability:** The accessibility tree exposes product names on search result pages — no vision call needed for the happy path. Grounding is a fallback only.
