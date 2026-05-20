import express from 'express'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'
import { readPointer, writePointer, readSave, writeSave, validateSave } from './files.ts'

const execAsync = promisify(exec)

async function openFilePicker(): Promise<string | null> {
  try {
    const { stdout } = await execAsync(
      `osascript -e 'POSIX path of (choose file with prompt "Select your save.json" of type {"public.json"})'`
    )
    return stdout.trim()
  } catch {
    return null // user cancelled
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = 4359
const app = express()

// On first run, create save.json and point to it automatically
const DEFAULT_SAVE_PATH = join(__dirname, '..', '..', 'save.json')
try {
  const pointer = readPointer()
  if (!pointer.savePath || !existsSync(pointer.savePath)) {
    if (!existsSync(DEFAULT_SAVE_PATH)) {
      writeSave(DEFAULT_SAVE_PATH, { lastPurchaseDate: null, cartStatus: 'pending', shoppingList: [] })
      console.log(`→ created save.json at ${DEFAULT_SAVE_PATH}`)
    }
    writePointer({ savePath: DEFAULT_SAVE_PATH })
  }
} catch (e) {
  console.error(`✗ could not initialise save.json: ${(e as Error).message}`)
}

app.use(express.json())

// Serve built React app (production)
const distPath = join(__dirname, '..', 'dist')
if (existsSync(distPath)) {
  app.use(express.static(distPath))
}

// --- API ---

app.get('/api/pointer', (_req, res) => {
  res.json(readPointer())
})

app.put('/api/pointer', (req, res) => {
  const { savePath } = req.body
  if (typeof savePath !== 'string' || !savePath.trim()) {
    res.status(400).json({ error: 'savePath must be a non-empty string' })
    return
  }
  writePointer({ savePath: savePath.trim() })
  res.json({ ok: true })
})

app.get('/api/save', (_req, res) => {
  const { savePath } = readPointer()
  if (!savePath) {
    res.status(400).json({ error: 'No save path configured' })
    return
  }
  try {
    res.json(readSave(savePath))
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

app.put('/api/save', (req, res) => {
  const { savePath } = readPointer()
  if (!savePath) {
    res.status(400).json({ error: 'No save path configured' })
    return
  }
  const error = validateSave(req.body)
  if (error) {
    res.status(400).json({ error })
    return
  }
  writeSave(savePath, req.body)
  res.json({ ok: true })
})

app.post('/api/pick-file', async (_req, res) => {
  const path = await openFilePicker()
  if (!path) { res.json({ path: null }); return }
  res.json({ path })
})

// SPA fallback (production)
if (existsSync(distPath)) {
  app.get('*', (_req, res) => {
    res.sendFile(join(distPath, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`→ shopping client: http://localhost:${PORT}`)
}).on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`✗ Port ${PORT} is already in use — is the shopping client already running?`)
    console.error(`  To kill it: lsof -ti:${PORT} | xargs kill`)
    process.exit(1)
  }
  throw err
})
