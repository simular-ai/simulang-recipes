import { useEffect, useState } from 'react'
import { api } from './api.ts'
import type { SaveFile } from './types.ts'
import SetupView from './components/SetupView.tsx'
import ShoppingList from './components/ShoppingList.tsx'

type AppState = 'loading' | 'setup' | 'ready' | 'error'

export default function App() {
  const [appState, setAppState] = useState<AppState>('loading')
  const [save, setSave] = useState<SaveFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  async function load() {
    setAppState('loading')
    setError(null)
    try {
      const pointer = await api.getPointer()
      if (!pointer.savePath) { setAppState('setup'); return }
      const saveData = await api.getSave()
      setSave(saveData)
      setDirty(false)
      setAppState('ready')
    } catch (e) {
      setError((e as Error).message)
      setAppState('error')
    }
  }

  useEffect(() => { load() }, [])

  async function handleSetPath(path: string) {
    await api.setPointer(path)
    await load()
  }

  async function handleSave(updated: SaveFile) {
    await api.putSave(updated)
    setSave(updated)
    setDirty(false)
  }

  function handleChange(updated: SaveFile) {
    setSave(updated)
    setDirty(true)
  }

  return (
    <div>
      <h1>Redmart Weekly Shopping</h1>
      {appState === 'loading' && <div className="loading">Loading…</div>}
      {(appState === 'setup' || appState === 'error') && (
        <SetupView error={error} onSetPath={handleSetPath} />
      )}
      {appState === 'ready' && (
        <ShoppingList
          save={save!}
          dirty={dirty}
          onChange={handleChange}
          onSave={handleSave}
          onChangeFile={() => setAppState('setup')}
        />
      )}
    </div>
  )
}
