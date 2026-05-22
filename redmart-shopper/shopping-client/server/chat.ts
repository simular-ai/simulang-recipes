import type { SaveFile, ShoppingItem } from '../src/types.ts'
import { readPointer, readSave, writeSave } from './files.ts'
import { slugify } from '../src/utils/slugify.ts'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = process.env.CHAT_MODEL ?? 'anthropic/claude-sonnet-4-6'

const TOOL = {
  UPSERT:  'upsert_items',
  REMOVAL: 'request_removal',
} as const

interface ContentBlock {
  type: string
  [key: string]: unknown
}

interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

interface OAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | ContentBlock[] | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

interface OAIResponse {
  choices: [{
    message: { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
    finish_reason: string
  }]
  error?: { message: string }
}

const TOOLS = [
  {
    type: 'function',
    function: {
      name: TOOL.UPSERT,
      description: 'Add new items or update existing items in the shopping list.',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Existing item ID to update, or a URL-friendly slug for new items (e.g. "oat-milk")' },
                name: { type: 'string', description: 'Product name' },
                description: { type: 'string', description: 'Brand, size, variant, flavour, etc.' },
                qty: { type: 'integer', minimum: 1, description: 'Weekly quantity' },
              },
              required: ['id', 'name', 'description', 'qty'],
            },
          },
        },
        required: ['items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: TOOL.REMOVAL,
      description: 'Request removal of items from the shopping list. Requires user confirmation before removing.',
      parameters: {
        type: 'object',
        properties: {
          item_ids: { type: 'array', items: { type: 'string' }, description: 'IDs of items to remove' },
          reason: { type: 'string', description: 'Brief reason for removal' },
        },
        required: ['item_ids'],
      },
    },
  },
]

let history: OAIMessage[] = []
let pendingRemovalIds: string[] = []

function getSave(): SaveFile {
  const { savePath } = readPointer()
  if (!savePath) throw new Error('No save file configured')
  return readSave(savePath)
}

function putSave(save: SaveFile): void {
  const { savePath } = readPointer()
  if (!savePath) throw new Error('No save file configured')
  writeSave(savePath, save)
}

function buildSystemMessage(): string {
  let listSection: string
  try {
    const save = getSave()
    listSection = save.shoppingList.length > 0
      ? '\n\nCurrent shopping list:\n' + save.shoppingList.map(i =>
          `- ${i.id}: ${i.name} (${i.description}) ×${i.qty}`
        ).join('\n')
      : '\n\nCurrent shopping list: (empty)'
  } catch {
    listSection = ''
  }

  return (
    'You are a helpful assistant managing a weekly Redmart grocery shopping list. ' +
    'Help users add, update, or remove items based on their messages and photos. ' +
    'Use upsert_items to add or edit items immediately. ' +
    'Use request_removal when the user wants to remove items — it requires their confirmation first. ' +
    'Item fields: id (URL-friendly slug, e.g. "oat-milk"), name (product name), description (brand/size/variant/flavour), qty (weekly quantity, must be a positive integer). ' +
    'The description field is used by an automated bot to search and identify the correct product on Redmart. Make it as specific as possible: include brand name, exact size/weight/volume, variant or flavour, and pack format. ' +
    'Good description: "Meiji full cream fresh milk 1L". Bad description: "Standard bottle" or "1 bunch" — these are useless for a search bot. ' +
    'If the brand is unknown, describe the product precisely enough to narrow it down: size, format, any distinguishing detail visible on the receipt or photo. ' +
    'When determining qty, reason carefully: if the source (receipt, photo, description) does not make the weekly quantity obvious, infer it from context — ' +
    'how quickly the item is likely consumed, how it compares to similar items already on the list, typical household usage, and pack sizes. ' +
    'For example, a receipt showing 2 packs bought this month suggests qty 1 per week (rounding up); a daily-use item in a single-person household suggests qty 1-2. ' +
    'Always pick a reasonable weekly qty rather than leaving it at 1 by default or copying the receipt quantity blindly. ' +
    'Image filenames are provided where available — reference them if they add useful context (e.g. a date or store name), ignore them if not. ' +
    'Keep responses short and conversational — no markdown, no tables, no bullet lists.' +
    listSection
  )
}

function applyUpsert(items: Array<{ id: string; name: string; description: string; qty: number }>): void {
  const save = getSave()
  const list = [...save.shoppingList]

  for (const item of items) {
    const id = item.id?.trim() || slugify(item.name) || crypto.randomUUID()
    const qty = Math.max(1, Math.round(item.qty))
    const idx = list.findIndex(i => i.id === id)
    if (idx >= 0) {
      list[idx] = { id, name: item.name, description: item.description, qty }
    } else {
      list.push({ id, name: item.name, description: item.description, qty })
    }
  }

  putSave({ ...save, shoppingList: list })
}

function getItemsByIds(ids: string[]): ShoppingItem[] {
  try { return getSave().shoppingList.filter(i => ids.includes(i.id)) }
  catch { return [] }
}

function compressImagesInHistory(): void {
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i]
    if (msg.role !== 'user' || !Array.isArray(msg.content)) continue

    const blocks = msg.content as ContentBlock[]
    const imageCount = blocks.filter(b => b.type === 'image_url').length
    if (imageCount === 0) continue

    history[i] = {
      role: 'user',
      content: [
        ...blocks.filter(b => b.type === 'text'),
        { type: 'text', text: `[User uploaded ${imageCount} image${imageCount > 1 ? 's' : ''} — already analyzed]` },
      ],
    }
    break
  }
}

async function callOpenRouter(systemMessage: string): Promise<OAIResponse> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY is not set')

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:4359',
      'X-Title': 'Redmart Shopping Assistant',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'system', content: systemMessage }, ...history],
      tools: TOOLS,
      max_tokens: 4096,
    }),
  })

  const data = await res.json() as OAIResponse
  if (!res.ok || data.error) throw new Error(data.error?.message ?? `OpenRouter error ${res.status}`)
  return data
}

export interface Attachment {
  name?: string
  mediaType: string
  base64: string
}

export interface ChatResult {
  reply: string
  pendingRemovals: ShoppingItem[]
}

export async function sendMessage(text: string, attachments: Attachment[]): Promise<ChatResult> {
  const content: ContentBlock[] = [
    ...attachments.flatMap(a => [
      ...(a.name ? [{ type: 'text', text: `[File: ${a.name}]` }] : []),
      { type: 'image_url', image_url: { url: `data:${a.mediaType};base64,${a.base64}` } },
    ]),
    ...(text.trim() ? [{ type: 'text', text: text.trim() }] : []),
  ]

  if (content.length === 0) throw new Error('Message is empty')

  history.push({ role: 'user', content })
  pendingRemovalIds = []

  const systemMessage = buildSystemMessage()
  let finalReply = ''

  while (true) {
    const response = await callOpenRouter(systemMessage)
    const msg = response.choices[0].message

    history.push({ role: 'assistant', content: msg.content ?? null, tool_calls: msg.tool_calls })
    finalReply = msg.content ?? ''

    if (response.choices[0].finish_reason !== 'tool_calls' || !msg.tool_calls?.length) break

    for (const call of msg.tool_calls) {
      const args = JSON.parse(call.function.arguments) as Record<string, unknown>

      if (call.function.name === TOOL.UPSERT) {
        try {
          applyUpsert(args.items as Array<{ id: string; name: string; description: string; qty: number }>)
          history.push({ role: 'tool', tool_call_id: call.id, content: `Applied: ${(args.items as unknown[]).length} item(s) updated.` })
        } catch (e) {
          history.push({ role: 'tool', tool_call_id: call.id, content: `Error: ${(e as Error).message}` })
        }
      } else if (call.function.name === TOOL.REMOVAL) {
        pendingRemovalIds = args.item_ids as string[]
        history.push({ role: 'tool', tool_call_id: call.id, content: 'Queued for user confirmation.' })
      }
    }
  }

  compressImagesInHistory()

  return { reply: finalReply, pendingRemovals: getItemsByIds(pendingRemovalIds) }
}

export function confirmRemoval(): void {
  if (!pendingRemovalIds.length) return
  try {
    const save = getSave()
    putSave({ ...save, shoppingList: save.shoppingList.filter(i => !pendingRemovalIds.includes(i.id)) })
  } catch {}
  history.push({ role: 'user', content: 'User confirmed the removal.' })
  pendingRemovalIds = []
}

export function denyRemoval(): void {
  if (!pendingRemovalIds.length) return
  history.push({ role: 'user', content: 'User declined the removal. Items stay in the list.' })
  pendingRemovalIds = []
}

export function resetConversation(): void {
  history = []
  pendingRemovalIds = []
}
