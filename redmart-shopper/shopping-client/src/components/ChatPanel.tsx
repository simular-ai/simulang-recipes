import { useState, useRef, useEffect } from 'react'
import type { ShoppingItem } from '../types.ts'
import { api } from '../api.ts'

interface Attachment {
  key: string
  name: string
  mediaType: string
  base64: string
  preview: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  attachmentPreviews?: string[]
  pendingRemovals?: ShoppingItem[]
  removalOutcome?: 'confirmed' | 'denied'
}

interface Props {
  onReloadSave: () => void
}

export default function ChatPanel({ onReloadSave }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function resizeImage(file: File): Promise<Omit<Attachment, 'key'>> {
    const MAX_PX = 1920
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        URL.revokeObjectURL(url)
        const scale = Math.min(1, MAX_PX / Math.max(img.naturalWidth, img.naturalHeight))
        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(img.naturalWidth  * scale)
        canvas.height = Math.round(img.naturalHeight * scale)
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
        resolve({ name: file.name, mediaType: 'image/jpeg', base64: dataUrl.split(',')[1], preview: dataUrl })
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error(`Failed to load image: ${file.name}`))
      }
      img.src = url
    })
  }

  async function pdfToImages(file: File): Promise<Array<Omit<Attachment, 'key'>>> {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).href

    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
    const pages: Array<Omit<Attachment, 'key'>> = []

    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n)
      const viewport = page.getViewport({ scale: 2 })
      const canvas = document.createElement('canvas')
      canvas.width  = viewport.width
      canvas.height = viewport.height
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
      const label = pdf.numPages > 1 ? `${file.name} p${n}` : file.name
      pages.push({ name: label, mediaType: 'image/jpeg', base64: dataUrl.split(',')[1], preview: dataUrl })
    }

    return pages
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const groups = await Promise.all(
      files.map(f => (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
        ? pdfToImages(f).catch(err => { setError(`PDF error: ${(err as Error).message}`); return [] })
        : resizeImage(f).then(a => [a]).catch(err => { setError((err as Error).message); return [] })
      )
    )
    const keyed: Attachment[] = groups.flat().map(a => ({ ...a, key: crypto.randomUUID() }))
    setAttachments(prev => [...prev, ...keyed])
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSend() {
    if (loading || (!input.trim() && attachments.length === 0)) return

    const userMsg: ChatMessage = {
      role: 'user',
      text: input,
      attachmentPreviews: attachments.map(a => a.preview),
    }

    const sent = attachments.slice()
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setAttachments([])
    setLoading(true)
    setError(null)

    try {
      const { reply, pendingRemovals } = await api.chat(
        input,
        sent.map(a => ({ name: a.name, mediaType: a.mediaType, base64: a.base64 }))
      )

      setMessages(prev => [...prev, {
        role: 'assistant',
        text: reply,
        pendingRemovals: pendingRemovals.length > 0 ? pendingRemovals : undefined,
      }])

      onReloadSave()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRemovalDecision(msgIndex: number, confirm: boolean) {
    try {
      confirm ? await api.chatConfirmRemoval() : await api.chatDenyRemoval()
      setMessages(prev => prev.map((m, i) =>
        i === msgIndex ? { ...m, removalOutcome: confirm ? 'confirmed' as const : 'denied' as const } : m
      ))
      if (confirm) onReloadSave()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function handleReset() {
    await api.chatReset()
    setMessages([])
    setError(null)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <h2>Shopping Assistant</h2>
        <button className="btn-ghost btn-small" onClick={handleReset} disabled={loading}>New chat</button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <p className="chat-empty">
            Upload a receipt photo or describe what you need — I'll update your list.
          </p>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg chat-msg-${msg.role}`}>
            {msg.attachmentPreviews?.map((src, j) => (
              src
                ? <img key={j} src={src} className="chat-img-preview" alt="attachment" />
                : <div key={j} className="chat-pdf-thumb chat-pdf-sent">PDF</div>
            ))}
            {msg.text && <div className="chat-bubble">{msg.text}</div>}
            {msg.pendingRemovals && (
              <div className="chat-removal-confirm">
                {msg.removalOutcome ? (
                  <p className="removal-outcome">
                    {msg.removalOutcome === 'confirmed' ? '✓ Items removed' : 'Items kept'}
                  </p>
                ) : (
                  <>
                    <p><strong>Remove these items?</strong></p>
                    <ul>
                      {msg.pendingRemovals.map(item => <li key={item.id}>{item.name}</li>)}
                    </ul>
                    <div className="chat-removal-actions">
                      <button className="btn-remove" onClick={() => handleRemovalDecision(i, true)}>Remove</button>
                      <button className="btn-ghost btn-small" onClick={() => handleRemovalDecision(i, false)}>Keep</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="chat-msg chat-msg-assistant">
            <div className="chat-bubble chat-typing">…</div>
          </div>
        )}

        {error && <div className="error-banner">{error}</div>}

        <div ref={bottomRef} />
      </div>

      {attachments.length > 0 && (
        <div className="chat-attachments">
          {attachments.map(att => (
            <div key={att.key} className="chat-att-thumb">
              {att.preview
                ? <img src={att.preview} alt={att.name} />
                : <div className="chat-pdf-thumb" title={att.name}>PDF</div>
              }
              <button onClick={() => setAttachments(prev => prev.filter(a => a.key !== att.key))}>×</button>
            </div>
          ))}
        </div>
      )}

      <div className="chat-input-row">
        <input ref={fileRef} type="file" accept="image/*,.pdf" multiple hidden onChange={handleFileSelect} />
        <button className="btn-ghost btn-small chat-attach-btn" onClick={() => fileRef.current?.click()} title="Attach image">
          ⊕
        </button>
        <textarea
          className="chat-textarea"
          placeholder="Type a message… (Enter to send)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          disabled={loading}
        />
        <button
          className="btn-primary btn-small"
          onClick={handleSend}
          disabled={loading || (!input.trim() && attachments.length === 0)}
        >
          Send
        </button>
      </div>
    </div>
  )
}
