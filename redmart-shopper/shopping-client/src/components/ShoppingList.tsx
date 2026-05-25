import { useEffect } from 'react'
import type { SaveFile, ShoppingItem } from '../types.ts'
import { slugify } from '../utils/slugify.ts'
import ItemRow from './ItemRow.tsx'
import MetaBar from './MetaBar.tsx'

interface Props {
  save: SaveFile
  dirty: boolean
  onChange: (save: SaveFile) => void
  onSave: (save: SaveFile) => Promise<void>
  onChangeFile: () => void
}

export default function ShoppingList({ save, dirty, onChange, onSave, onChangeFile }: Props) {
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  function updateItem(i: number, updated: ShoppingItem) {
    const list = [...save.shoppingList]
    list[i] = updated
    onChange({ ...save, shoppingList: list })
  }

  function removeItem(i: number) {
    onChange({ ...save, shoppingList: save.shoppingList.filter((_, idx) => idx !== i) })
  }

  function addItem() {
    const item: ShoppingItem = { id: crypto.randomUUID(), name: '', description: '', qty: 1 }
    onChange({ ...save, shoppingList: [...save.shoppingList, item] })
  }

  async function handleSave() {
    const withIds = {
      ...save,
      shoppingList: save.shoppingList.map((item) => ({
        ...item,
        id: item.id || slugify(item.name) || crypto.randomUUID(),
      })),
    }
    await onSave(withIds)
  }

  return (
    <div>
      <p className="list-description">
        These items will be added to your Redmart cart weekly. You'll still need to review and confirm payment manually.
      </p>
      <div className="toolbar">
        <button className="btn-ghost" onClick={addItem}>
          + Add item
        </button>
        <button className="btn-primary" onClick={handleSave} disabled={!dirty}>
          Save
        </button>
        <span className={`status-bar ${dirty ? 'unsaved' : 'saved'}`}>{dirty ? 'Unsaved changes' : 'Saved'}</span>
        <button className="btn-ghost btn-small" onClick={onChangeFile}>
          Change file…
        </button>
      </div>

      {save.shoppingList.length === 0 ? (
        <div className="empty-state">
          <strong>No items yet</strong>
          <p>Click "+ Add item" to get started.</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ width: '30%' }}>Name</th>
              <th style={{ width: '45%' }}>Description</th>
              <th style={{ width: '10%' }}>Qty</th>
              <th style={{ width: '15%' }}></th>
            </tr>
          </thead>
          <tbody>
            {save.shoppingList.map((item, i) => (
              <ItemRow
                key={item.id}
                item={item}
                onChange={(updated) => updateItem(i, updated)}
                onRemove={() => removeItem(i)}
              />
            ))}
          </tbody>
        </table>
      )}

      <MetaBar save={save} />
    </div>
  )
}
