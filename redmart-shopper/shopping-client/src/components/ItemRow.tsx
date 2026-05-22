import type { ShoppingItem } from '../types.ts'

interface Props {
  item: ShoppingItem
  onChange: (updated: ShoppingItem) => void
  onRemove: () => void
}

export default function ItemRow({ item, onChange, onRemove }: Props) {
  return (
    <tr>
      <td>
        <input
          type="text"
          value={item.name}
          placeholder="Oat Milk"
          onChange={e => onChange({ ...item, name: e.target.value })}
        />
      </td>
      <td>
        <input
          type="text"
          value={item.description}
          placeholder="Oatside 1L oat milk"
          onChange={e => onChange({ ...item, description: e.target.value })}
        />
      </td>
      <td>
        <input
          type="number"
          value={item.qty}
          min={1}
          max={99}
          onChange={e => onChange({ ...item, qty: Math.max(1, parseInt(e.target.value) || 1) })}
        />
      </td>
      <td>
        <button className="btn-danger" onClick={onRemove}>Remove</button>
      </td>
    </tr>
  )
}
