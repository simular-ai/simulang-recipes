import type { Pointer, SaveFile, ShoppingItem } from './types'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, options)
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? 'Request failed')
  return body
}

export const api = {
  getPointer: () =>
    request<Pointer>('/pointer'),

  setPointer: (savePath: string) =>
    request<{ ok: true }>('/pointer', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ savePath }),
    }),

  getSave: () =>
    request<SaveFile>('/save'),

  putSave: (save: SaveFile) =>
    request<{ ok: true }>('/save', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(save),
    }),

  pickFile: () =>
    request<{ path: string | null }>('/pick-file', { method: 'POST' }),

  chat: (text: string, attachments: Array<{ name: string; mediaType: string; base64: string }>) =>
    request<{ reply: string; pendingRemovals: ShoppingItem[] }>('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, attachments }),
    }),

  chatConfirmRemoval: () =>
    request<{ ok: true }>('/chat/confirm-removal', { method: 'POST' }),

  chatDenyRemoval: () =>
    request<{ ok: true }>('/chat/deny-removal', { method: 'POST' }),

  chatReset: () =>
    request<{ ok: true }>('/chat', { method: 'DELETE' }),
}
