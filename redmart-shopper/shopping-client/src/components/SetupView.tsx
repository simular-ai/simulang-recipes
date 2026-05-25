import { useState } from 'react'
import { api } from '../api.ts'

interface Props {
  error: string | null
  onSetPath: (path: string) => Promise<void>
}

export default function SetupView({ error, onSetPath }: Props) {
  const [path, setPath] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(error)

  async function handleBrowse() {
    try {
      const { path: picked } = await api.pickFile()
      if (picked) setPath(picked)
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!path.trim()) return
    setLoading(true)
    setErr(null)
    try {
      await onSetPath(path.trim())
    } catch (e) {
      setErr((e as Error).message)
      setLoading(false)
    }
  }

  return (
    <div className="setup-view">
      <h2>Connect save file</h2>
      <p>
        Choose your <code>save.json</code> file to get started.
      </p>
      {err && <div className="error-banner">{err}</div>}
      <button className="btn-primary" onClick={handleBrowse}>
        Browse…
      </button>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="/Users/you/redmart-shopper/save.json"
          spellCheck={false}
        />
        <button type="submit" className="btn-ghost" disabled={loading || !path.trim()}>
          {loading ? 'Connecting…' : 'Connect'}
        </button>
      </form>
    </div>
  )
}
