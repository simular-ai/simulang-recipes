# Redmart Shopper

A two-part weekly grocery automation. A local HTML tool lets you upload receipts and build a spending profile. A Simulang script reads that profile, checks if a weekly shop is due, fills your Redmart cart, and opens it in the browser so you just review and pay.

## Components

```
redmart-shopper/
├── README.md
├── receipt-analyzer.html   # Upload receipts → extract line items → update save.json
├── main.ts                 # Entry point: checks schedule, orchestrates the full run
├── shopper.ts              # Redmart browser automation (search, add to cart, open cart)
├── analyzer.ts             # Spending analysis: builds nextShoppingList from receipt history
├── config.ts               # User-editable settings
├── save.json               # Runtime state (gitignored)
├── save.json.example       # Schema reference with example values
└── package.json
```

## Workflow Overview

### Phase 1 — Receipt ingestion (manual, run whenever you have new receipts)

```
[Open receipt-analyzer.html in browser]
  → [Upload receipt images or PDFs]
  → [Page calls OpenRouter to extract line items]
  → [Extracted items appended to save.json receipts[]]
  → [analyzer.ts re-derives spendingProfile + nextShoppingList]
  → [save.json written to disk]
```

### Phase 2 — Weekly shop (run by cron every Sunday, or manually)

```
[main.ts]
  → [Read save.json]
  → [Does save.json exist?]
      → no: exit with error "run receipt-analyzer.html first"
  → [Is today >= lastPurchaseDate + intervalDays?]
      → no: exit early, log "next shop due on <date>"
  → [Is nextShoppingList non-empty?]
      → no: exit with warning "shopping list is empty — upload more receipts"
  → [shopper.ts: open Redmart, search + add each item]
  → [shopper.ts: open cart tab]
  → [Update save.json: lastPurchaseDate = today, cartStatus = "ready"]
  → [Exit — user completes checkout manually]
```

## save.json Schema

This file is the single source of truth for all runtime state. It is gitignored and created on first receipt upload.

```json
{
  "lastPurchaseDate": "2026-05-12",
  "intervalDays": 7,
  "cartStatus": "pending",
  "spendingProfile": {
    "monthlyAvgSpend": 187.50,
    "categories": {
      "dairy": 42.00,
      "produce": 55.00,
      "pantry": 60.00,
      "snacks": 18.50,
      "household": 12.00
    },
    "topItems": [
      {
        "name": "Oat Milk",
        "normalizedName": "oat milk",
        "avgQtyPerShop": 2,
        "avgIntervalDays": 7,
        "lastSeenDate": "2026-05-12",
        "avgUnitPrice": 4.50,
        "category": "dairy"
      }
    ]
  },
  "receipts": [
    {
      "id": "receipt_20260512_001",
      "uploadedAt": "2026-05-13T08:22:00Z",
      "receiptDate": "2026-05-12",
      "source": "NTUC FairPrice",
      "total": 67.50,
      "currency": "SGD",
      "items": [
        {
          "name": "Oat Milk 1L",
          "normalizedName": "oat milk",
          "qty": 2,
          "unitPrice": 4.50,
          "totalPrice": 9.00,
          "category": "dairy"
        }
      ]
    }
  ],
  "nextShoppingList": [
    {
      "name": "Oat Milk",
      "searchQuery": "oat milk 1L",
      "qty": 2,
      "estimatedUnitPrice": 4.50,
      "category": "dairy",
      "reason": "purchased every ~7 days, last bought 2026-05-12"
    }
  ]
}
```

### `cartStatus` values

| Value | Meaning |
|-------|---------|
| `"pending"` | Shopping list exists but shop hasn't run yet |
| `"adding"` | Script is currently adding items to cart |
| `"ready"` | All items added, cart tab opened in browser |
| `"error"` | Script failed mid-run — check logs |

## config.ts Schema

User-editable settings kept separate from runtime state.

```ts
export const config = {
  intervalDays: 7,           // how often to shop
  openRouterApiKey: process.env.OPENROUTER_API_KEY,
  redmartUrl: "https://redmart.lazada.sg",
  saveFilePath: "./save.json",
  minItemConfidence: 0.8,    // skip items the LLM extracted with lower confidence
  maxItemsPerShop: 30,       // safety cap on cart size
}
```

## receipt-analyzer.html

A self-contained HTML page. No server required — runs entirely in the browser.

- Accepts image (JPG, PNG) and PDF file uploads via drag-and-drop or file picker
- Sends each file to OpenRouter (vision model) to extract: date, store name, line items (name, qty, unit price), and total
- Normalizes item names for deduplication across receipts
- Reads the existing `save.json` via the File System Access API, merges new receipts, re-derives `spendingProfile` and `nextShoppingList`, and writes back

### Shopping list derivation logic

An item makes it onto `nextShoppingList` if:
1. It appears in at least 2 receipts (filters one-off purchases)
2. Its average purchase interval is <= `intervalDays * 1.5` (filters items you only buy occasionally)
3. It hasn't been purchased within the last `intervalDays * 0.8` days (avoids buying things you still have)

## main.ts

Entry point for the weekly run.

1. Reads and validates `save.json` — exits with a clear error if missing or malformed
2. Computes `nextDueDate = lastPurchaseDate + intervalDays`
3. If today < `nextDueDate`, logs the next due date and exits cleanly
4. Sets `cartStatus = "adding"` and writes to `save.json`
5. Calls `shopper.ts` with the `nextShoppingList`
6. On success: sets `lastPurchaseDate = today`, `cartStatus = "ready"`, writes `save.json`
7. Opens `https://redmart.lazada.sg/cart` in the default browser

## shopper.ts

Drives the Redmart browser UI via Simulang.

For each item in `nextShoppingList`:
1. Navigate to Redmart search with `searchQuery`
2. Read first 3–5 results from the accessibility tree
3. Match the best result to the item name (fuzzy string match, no model call)
4. If no confident match: fall back to `screenshot.ground(model, item.name)` to locate the first result visually
5. Add `qty` units to cart
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
4. Review the generated `save.json` — check `nextShoppingList` looks right

**Weekly run:**
```
simulang run main.ts
```

Or schedule it:
```
# cron: every Sunday at 9am
0 9 * * 0 cd /path/to/redmart-shopper && simulang run main.ts
```

**To stop mid-run:** move your cursor to a corner of the screen or switch to another window.

## Notes

- **Why File System Access API for the HTML tool?** Avoids needing a local server. The browser reads and writes `save.json` directly with a one-time folder permission grant.
- **Why no auto-checkout?** Payment is irreversible. The script stops at a populated cart so you stay in control.
- **Redmart search reliability:** The accessibility tree exposes product names on search results pages — no vision call needed for the happy path. Grounding is a fallback only.
- **Receipt normalization:** Item names from receipts vary ("Oat Milk 1L Organic", "OAT MLK 1LT") — the LLM extraction step normalizes these to a canonical name used for deduplication and search.
