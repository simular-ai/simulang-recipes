import type { SaveFile } from '../types.ts'

interface Props {
  save: SaveFile
}

function nextShopDate(lastPurchaseDate: string | null): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const earliest = lastPurchaseDate
    ? (() => {
        const d = new Date(lastPurchaseDate)
        d.setHours(0, 0, 0, 0)
        d.setDate(d.getDate() + 7)
        return d
      })()
    : today

  const daysUntilSat = (6 - earliest.getDay() + 7) % 7
  const next = new Date(earliest)
  next.setDate(earliest.getDate() + daysUntilSat)
  return next
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MetaBar({ save }: Props) {
  const next = nextShopDate(save.lastPurchaseDate)
  const isOverdue = next <= new Date()

  return (
    <div className="meta-bar">
      <span>
        Last purchase: <strong>{save.lastPurchaseDate ?? 'Never'}</strong>
      </span>
      <span>
        Next purchase: <strong className={isOverdue ? 'overdue' : ''}>{formatDate(next)}</strong>
      </span>
      <span>
        Cart status: <strong>{save.cartStatus}</strong>
      </span>
    </div>
  )
}
