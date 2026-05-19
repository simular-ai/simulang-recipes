import { readFileSync, writeFileSync, existsSync } from 'fs'
import type { ShoppingItem } from './shopper.ts'
import { config } from './config.ts'

export interface SaveFile {
  lastPurchaseDate: string | null
  cartStatus: 'pending' | 'adding' | 'ready' | 'error'
  shoppingList: ShoppingItem[]
}

export function loadSave(): SaveFile {
  if (!existsSync(config.saveFilePath)) {
    console.error('✗ save.json not found — run the shopping client (npm run client) to create your list first.')
    process.exit(1)
  }
  return JSON.parse(readFileSync(config.saveFilePath, 'utf8'))
}

export function writeSave(save: SaveFile) {
  writeFileSync(config.saveFilePath, JSON.stringify(save, null, 2))
}

export function isShopDue(lastPurchaseDate: string | null, force: boolean): boolean {
  if (force) return true

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (today.getDay() !== 6) {
    console.log(`  → not Saturday — skipping (next check tomorrow)`)
    return false
  }

  if (!lastPurchaseDate) return true

  const last = new Date(lastPurchaseDate)
  last.setHours(0, 0, 0, 0)
  const daysSince = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))

  if (daysSince < 7) {
    const next = nextShopDate(lastPurchaseDate)
    console.log(`last purchase: ${lastPurchaseDate} (${daysSince} day(s) ago)`)
    console.log(`next shop due: ${next.toDateString()} — use --force to run anyway.`)
    return false
  }

  return true
}

export function nextShopDate(lastPurchaseDate: string | null): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const earliest = lastPurchaseDate
    ? (() => { const d = new Date(lastPurchaseDate); d.setHours(0,0,0,0); d.setDate(d.getDate() + 7); return d })()
    : today

  const daysUntilSat = (6 - earliest.getDay() + 7) % 7
  const next = new Date(earliest)
  next.setDate(earliest.getDate() + daysUntilSat)
  return next
}
