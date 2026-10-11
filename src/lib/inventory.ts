import type { InventoryItem } from '../types/database'

export function isLowStock(item: Pick<InventoryItem, 'quantity' | 'minimum_quantity'>) {
  return Number(item.quantity) <= Number(item.minimum_quantity)
}

export function stockLabel(item: Pick<InventoryItem, 'quantity' | 'minimum_quantity' | 'unit'>) {
  return `${item.quantity} ${item.unit}`
}
