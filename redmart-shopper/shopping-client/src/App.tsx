import { useEffect, useRef, useState } from 'react'
import { api } from './api.ts'
import type { SaveFile } from './types.ts'
import SetupView from './components/SetupView.tsx'
import ShoppingList from './components/ShoppingList.tsx'
import ChatPanel from './components/ChatPanel.tsx'

type AppState =
  | { status: 'loading' }
  | { status: 'setup' | 'error'; error: string | null }
  | { status: 'ready'; save: SaveFile; dirty: boolean }

export default function App() {
  const [state, setState] = useState<AppState>({ status: 'loading' })
  const stateRef = useRef(state)
  stateRef.current = state
  const [notice, setNotice] = useState<string | null>(null)

  async function load() {
    setState({ status: 'loading' })
    try {
      const pointer = await api.getPointer()
      if (!pointer.savePath) {
        setState({ status: 'setup', error: null })
        return
      }
      const save = await api.getSave()
      setState({ status: 'ready', save, dirty: false })
    } catch (e) {
      setState({ status: 'error', error: (e as Error).message })
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSetPath(path: string) {
    await api.setPointer(path)
    await load()
  }

  async function handleSave(updated: SaveFile) {
    await api.putSave(updated)
    setState({ status: 'ready', save: updated, dirty: false })
  }

  async function reloadSave() {
    try {
      const save = await api.getSave()
      const wasDirty = stateRef.current.status === 'ready' && stateRef.current.dirty
      setState({ status: 'ready', save, dirty: false })
      if (wasDirty) {
        setNotice('Your list was updated by the assistant — unsaved edits were replaced.')
        setTimeout(() => setNotice(null), 4000)
      }
    } catch {}
  }

  function handleChange(updated: SaveFile) {
    if (state.status !== 'ready') return
    setState({ ...state, save: updated, dirty: true })
  }

  return (
    <div className={state.status === 'ready' ? 'app-wide' : 'app-centered'}>
      <h1>Redmart Weekly Shopping</h1>
      {state.status === 'loading' && <div className="loading">Loading…</div>}
      {(state.status === 'setup' || state.status === 'error') && (
        <SetupView error={state.error} onSetPath={handleSetPath} />
      )}
      {notice && <div className="notice-banner">{notice}</div>}
      {state.status === 'ready' && (
        <div className="app-cols">
          <div className="app-col-main">
            <ShoppingList
              save={state.save}
              dirty={state.dirty}
              onChange={handleChange}
              onSave={handleSave}
              onChangeFile={() => setState({ status: 'setup', error: null })}
            />
          </div>
          <div className="app-col-chat">
            <ChatPanel onReloadSave={reloadSave} />
          </div>
        </div>
      )}
    </div>
  )
}
