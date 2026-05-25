import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { Pointer, SaveFile } from '../src/types.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const POINTER_PATH = join(__dirname, '..', 'pointer.json')

export function readPointer(): Pointer {
  if (!existsSync(POINTER_PATH)) return { savePath: null }
  try {
    return JSON.parse(readFileSync(POINTER_PATH, 'utf8'))
  } catch {
    return { savePath: null }
  }
}

export function writePointer(pointer: Pointer): void {
  writeFileSync(POINTER_PATH, JSON.stringify(pointer, null, 2))
}

function validateItem(item: unknown, i: number): string | null {
  if (typeof item !== 'object' || item === null) return `shoppingList[${i}] is not an object`
  const it = item as Record<string, unknown>
  if (typeof it.id !== 'string' || !it.id.trim()) return `shoppingList[${i}].id must be a non-empty string`
  if (typeof it.name !== 'string' || !it.name.trim()) return `shoppingList[${i}].name must be a non-empty string`
  if (typeof it.description !== 'string') return `shoppingList[${i}].description must be a string`
  if (typeof it.qty !== 'number' || !Number.isInteger(it.qty) || it.qty < 1)
    return `shoppingList[${i}].qty must be a positive integer`
  return null
}

export function validateSave(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return 'Not a valid JSON object'
  const d = data as Record<string, unknown>
  if (!Array.isArray(d.shoppingList)) return 'Missing or invalid "shoppingList" array'
  for (let i = 0; i < d.shoppingList.length; i++) {
    const err = validateItem(d.shoppingList[i], i)
    if (err) return err
  }
  if (!(d.lastPurchaseDate === null || typeof d.lastPurchaseDate === 'string'))
    return '"lastPurchaseDate" must be a string or null'
  if (!('cartStatus' in d)) return 'Missing "cartStatus" field'
  if (!['pending', 'adding', 'ready', 'error'].includes(d.cartStatus as string))
    return `Invalid "cartStatus" value: "${d.cartStatus}"`
  return null
}

export function readSave(savePath: string): SaveFile {
  if (!existsSync(savePath)) throw new Error(`File not found: ${savePath}`)
  const data = JSON.parse(readFileSync(savePath, 'utf8'))
  const error = validateSave(data)
  if (error) throw new Error(error)
  return data as SaveFile
}

export function writeSave(savePath: string, save: SaveFile): void {
  writeFileSync(savePath, JSON.stringify(save, null, 2))
}
