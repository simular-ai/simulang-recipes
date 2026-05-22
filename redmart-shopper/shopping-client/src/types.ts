export interface ShoppingItem {
  id: string
  name: string
  description: string
  qty: number
}

export interface SaveFile {
  lastPurchaseDate: string | null
  cartStatus: 'pending' | 'adding' | 'ready' | 'error'
  shoppingList: ShoppingItem[]
}

export interface Pointer {
  savePath: string | null
}
